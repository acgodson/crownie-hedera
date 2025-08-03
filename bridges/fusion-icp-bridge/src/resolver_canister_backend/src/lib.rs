use candid::Principal;
use ic_cdk::api::management_canister::http_request::{HttpResponse, TransformArgs};
use std::cell::RefCell;
use std::collections::HashMap;

mod types;
mod utils;
mod external;

use types::*;
use utils::ResolverUtils;
use external::{EvmRpcClient, IcpEscrowParams, deploy_icp_escrow, check_icp_escrow_funding, release_icp_escrow};

thread_local! {
    static STATE: RefCell<ResolverOrchestrator> = RefCell::new(ResolverOrchestrator::default());
}

#[derive(Default)]
struct ResolverOrchestrator {
    active_swaps: HashMap<String, CrossChainSwap>,
    completed_swaps: HashMap<String, u64>,
    config: OrchestratorConfig,
    secret_store: HashMap<String, [u8; 32]>,
    wallet_canister: Option<Principal>,
    created_icp_escrows: HashMap<String, Principal>, 
    escrow_count: u64, 
}


#[ic_cdk::init]
fn init(wallet_canister: Principal) {
    STATE.with(|state| {
        state.borrow_mut().wallet_canister = Some(wallet_canister);
    });
}


#[ic_cdk::update]
pub async fn set_wallet_canister(wallet_canister: Principal) -> ResolverResult<()> {
    STATE.with(|state| {
        state.borrow_mut().wallet_canister = Some(wallet_canister);
    });
    Ok(())
}

#[ic_cdk::query]
pub fn get_wallet_canister() -> Option<Principal> {
    STATE.with(|state| state.borrow().wallet_canister)
}


#[ic_cdk::update]
pub async fn get_wallet_eth_address() -> ResolverResult<String> {
    let wallet_canister = STATE.with(|state| state.borrow().wallet_canister)
        .ok_or_else(|| ResolverError::ProcessingError("Wallet canister not set".to_string()))?;
    
    let result: Result<(Result<String, String>,), _> = 
        ic_cdk::call(wallet_canister, "get_eth_address", ()).await;
    
    match result {
        Ok((Ok(address),)) => Ok(address),
        Ok((Err(error),)) => Err(ResolverError::ExternalCallError(format!("Wallet error: {}", error))),
        Err((code, msg)) => Err(ResolverError::ExternalCallError(format!("Call failed: {:?} - {}", code, msg))),
    }
}


#[ic_cdk::update]
pub async fn initiate_evm_to_icp_swap(
    user_eth_address: String,
    user_icp_principal: String,
    source_token: String,      // ETH/USDC address
    dest_token: String,        // WICP address  
    amount: u128,
    timelock_duration: u64,
) -> ResolverResult<SwapInitiationResult> {
    // Generate swap ID and HTLC params
    let swap_id = format!("evm_to_icp_{}", ic_cdk::api::time());
    let secret = ResolverUtils::generate_htlc_secret();
    let secret_hash = ResolverUtils::generate_secret_hash(&secret);
    let timelock = ic_cdk::api::time() / 1_000_000_000 + timelock_duration; // Convert to seconds
    
    // Parse ICP principal from string
    let recipient_principal = Principal::from_text(&user_icp_principal)
        .map_err(|e| ResolverError::InvalidInput(format!("Invalid ICP principal: {}", e)))?;
    let dest_token_ledger = Principal::from_text(&dest_token)
        .map_err(|e| ResolverError::InvalidInput(format!("Invalid destination token ledger: {}", e)))?;
    
    let evm_client = get_evm_client();
    
    // 1. Deploy source escrow on EVM (user will fund this)
    let source_escrow = evm_client.deploy_source_escrow(
        &user_eth_address,   
        &source_token,
        amount,
        secret_hash,
        timelock,
    ).await?;
    
    // 2. Deploy destination escrow on ICP (user receives native ICP/ICRC tokens)
    let dest_escrow_canister = create_icp_escrow_for_swap(
        &format!("{}_dest", swap_id), 
        secret_hash,
        timelock,
        amount,
        dest_token_ledger,         
        ic_cdk::id(),           
        recipient_principal,       
    ).await?;
    
    // 3. Resolver funds ICP destination escrow with native tokens
    fund_icp_dest_escrow(&dest_escrow_canister, &dest_token_ledger, amount).await?;
    
    // Store swap details
    STATE.with(|state| {
        let swap = CrossChainSwap {
            swap_id: swap_id.clone(),
            direction: SwapDirection::EvmToIcp,
            user_address: user_eth_address.clone(),
            user_icp_principal: user_icp_principal.clone(),
            source_token: source_token.clone(),
            dest_token: dest_token.clone(),
            amount,
            secret_hash,
            timelock,
            source_escrow: Some(source_escrow.clone()),
            dest_escrow: Some(dest_escrow_canister.to_text()), 
            source_escrow_canister: None,
            status: SwapStatus::EscrowsDeployed,
            secret: Some(secret), 
        };
        state.borrow_mut().active_swaps.insert(swap_id.clone(), swap);
        state.borrow_mut().secret_store.insert(swap_id.clone(), secret);
    });
    
    let funding_instructions = FundingInstructions {
        user_action: format!("Send {} of {} tokens to EVM escrow {}", amount, source_token, source_escrow),
        required_amount: amount,
        token_address: source_token,
        deadline: timelock,
    };
    
    Ok(SwapInitiationResult {
        swap_id,
        source_escrow_address: source_escrow,
        dest_escrow_address: dest_escrow_canister.to_text(),
        funding_instructions,
    })
}

#[ic_cdk::update]
pub async fn initiate_icp_to_evm_swap(
    user_icp_principal: String,
    user_eth_address: String,
    source_token: String,      // WICP address
    dest_token: String,        // ETH/USDC address
    amount: u128,
    timelock_duration: u64,
) -> ResolverResult<SwapInitiationResult> {
    let swap_id = format!("icp_to_evm_{}", ic_cdk::api::time());
    let secret = ResolverUtils::generate_htlc_secret();
    let secret_hash = ResolverUtils::generate_secret_hash(&secret);
    let timelock = ic_cdk::api::time() / 1_000_000_000 + timelock_duration;
    
    // Parse ICP principal from string
    let depositor_principal = Principal::from_text(&user_icp_principal)
        .map_err(|e| ResolverError::InvalidInput(format!("Invalid ICP principal: {}", e)))?;
    let recipient_principal = Principal::from_text(&user_eth_address)
        .map_err(|e| ResolverError::InvalidInput(format!("Invalid recipient principal: {}", e)))?;
    let token_ledger = Principal::from_text(&source_token)
        .map_err(|e| ResolverError::InvalidInput(format!("Invalid token ledger: {}", e)))?;
    
    // 1. Deploy source escrow on ICP (user will deposit native ICP/ICRC tokens)
    let source_escrow_canister = create_icp_escrow_for_swap(
        &swap_id,
        secret_hash,
        timelock,
        amount,
        token_ledger,
        depositor_principal,
        recipient_principal,
    ).await?;
    
    let evm_client = get_evm_client();
    
    // 2. Deploy destination escrow on EVM (resolver funds with ETH/USDC)
    let dest_escrow = evm_client.deploy_dest_escrow(
        &user_eth_address,   // User receives ETH/USDC here
        &dest_token,
        amount,
        secret_hash,
        timelock,
    ).await?;
    
    // 3. Resolver funds destination escrow with wallet
    fund_dest_escrow_via_wallet(&dest_escrow, &dest_token, amount).await?;
    
    STATE.with(|state| {
        let swap = CrossChainSwap {
            swap_id: swap_id.clone(),
            direction: SwapDirection::IcpToEvm,
            user_address: user_eth_address.clone(),
            user_icp_principal: user_icp_principal.clone(),
            source_token: source_token.clone(),
            dest_token: dest_token.clone(),
            amount,
            secret_hash,
            timelock,
            source_escrow: Some(source_escrow_canister.to_text()), // ICP canister principal as string
            dest_escrow: Some(dest_escrow.clone()),
            source_escrow_canister: Some(source_escrow_canister), // Store the actual Principal
            status: SwapStatus::EscrowsDeployed,
            secret: Some(secret),
        };
        state.borrow_mut().active_swaps.insert(swap_id.clone(), swap);
        state.borrow_mut().secret_store.insert(swap_id.clone(), secret);
    });
    
    // Create funding instructions for user (for native ICP/ICRC tokens)
    let funding_instructions = FundingInstructions {
        user_action: format!("Send {} tokens to ICP escrow canister {}", amount, source_escrow_canister.to_text()),
        required_amount: amount,
        token_address: source_token, // This is the ICRC-1 ledger principal
        deadline: timelock,
    };
    
    Ok(SwapInitiationResult {
        swap_id,
        source_escrow_address: source_escrow_canister.to_text(), // ICP canister principal
        dest_escrow_address: dest_escrow,
        funding_instructions,
    })
}

#[ic_cdk::query]
pub fn get_swap_details(swap_id: String) -> ResolverResult<CrossChainSwap> {
    STATE.with(|state| {
        let swaps = &state.borrow().active_swaps;
        if let Some(swap) = swaps.get(&swap_id) {
            Ok(swap.clone())
        } else {
            Err(ResolverError::OrderNotFound("Swap not found".to_string()))
        }
    })
}

#[ic_cdk::update]
pub async fn check_escrow_funding(swap_id: String) -> ResolverResult<EscrowFundingStatus> {
    let swap = STATE.with(|state| {
        let swaps = &state.borrow().active_swaps;
        swaps.get(&swap_id).cloned()
    }).ok_or_else(|| ResolverError::OrderNotFound("Swap not found".to_string()))?;
    
    let evm_client = get_evm_client();
    
    let (source_funded, dest_funded) = match swap.direction {
        SwapDirection::EvmToIcp => {
            let source_funded = if let Some(ref escrow) = swap.source_escrow {
                evm_client.check_escrow_balance(escrow, swap.amount).await?
            } else { false };
            
            let dest_funded = if let Some(ref escrow) = swap.dest_escrow {
                if let Ok(canister_id) = Principal::from_text(escrow) {
                    check_icp_escrow_funding(canister_id).await?
                } else { false }
            } else { false };
            
            (source_funded, dest_funded)
        }
        SwapDirection::IcpToEvm => {
            let source_funded = if let Some(canister_id) = swap.source_escrow_canister {
                check_icp_escrow_funding(canister_id).await?
            } else { false };
            
            let dest_funded = if let Some(ref escrow) = swap.dest_escrow {
                evm_client.check_escrow_balance(escrow, swap.amount).await?
            } else { false };
            
            (source_funded, dest_funded)
        }
    };
    
    let status = match (source_funded, dest_funded) {
        (true, true) => EscrowFundingStatus::BothFunded,
        (true, false) => EscrowFundingStatus::SourceFunded,
        (false, true) => EscrowFundingStatus::DestFunded,
        (false, false) => EscrowFundingStatus::NeitherFunded,
    };
    
    // Update swap status if both funded
    if matches!(status, EscrowFundingStatus::BothFunded) {
        STATE.with(|state| {
            if let Some(swap) = state.borrow_mut().active_swaps.get_mut(&swap_id) {
                swap.status = SwapStatus::ReadyForExecution;
            }
        });
    }
    
    Ok(status)
}

// #[ic_cdk::update]
// pub async fn execute_atomic_swap(swap_id: String) -> ResolverResult<SwapExecutionResult> {
//     // Get swap and secret
//     let (swap, secret) = STATE.with(|state| {
//         let state_ref = state.borrow();
//         let swap = state_ref.active_swaps.get(&swap_id)
//             .ok_or_else(|| ResolverError::OrderNotFound("Swap not found".to_string()))?
//             .clone();
//         let secret = state_ref.secret_store.get(&swap_id)
//             .ok_or_else(|| ResolverError::ProcessingError("Secret not found".to_string()))?
//             .clone();
//         Ok((swap, secret))
//     })?;
    
//     // Verify swap is ready
//     if swap.status != SwapStatus::ReadyForExecution {
//         return Err(ResolverError::ProcessingError("Swap not ready for execution".to_string()));
//     }
    
//     let evm_client = get_evm_client();
    
//     let (source_tx, dest_tx) = match swap.direction {
//         SwapDirection::EvmToIcp => {
//             let source_tx = if let Some(ref escrow) = swap.source_escrow {
//                 evm_client.release_escrow_to_resolver(escrow, secret).await?
//             } else {
//                 return Err(ResolverError::ProcessingError("Source escrow not found".to_string()));
//             };
            
//             let dest_tx = if let Some(ref escrow) = swap.dest_escrow {
//                 if let Ok(canister_id) = Principal::from_text(escrow) {
//                     release_icp_escrow(canister_id, secret).await?
//                 } else {
//                     return Err(ResolverError::ProcessingError("Invalid ICP escrow principal".to_string()));
//                 }
//             } else {
//                 return Err(ResolverError::ProcessingError("Destination escrow not found".to_string()));
//             };
            
//             (source_tx, dest_tx)
//         }
//         SwapDirection::IcpToEvm => {
//             let source_tx = if let Some(canister_id) = swap.source_escrow_canister {
//                 release_icp_escrow(canister_id, secret).await?
//             } else {
//                 return Err(ResolverError::ProcessingError("Source escrow canister not found".to_string()));
//             };
            
//             let dest_tx = if let Some(ref escrow) = swap.dest_escrow {
//                 evm_client.release_escrow_to_user(escrow, secret).await?
//             } else {
//                 return Err(ResolverError::ProcessingError("Destination escrow not found".to_string()));
//             };
            
//             (source_tx, dest_tx)
//         }
//     };
    
//     // Update state
//     STATE.with(|state| {
//         let mut state_mut = state.borrow_mut();
//         if let Some(swap) = state_mut.active_swaps.get_mut(&swap_id) {
//             swap.status = SwapStatus::Completed;
//         }
//         state_mut.completed_swaps.insert(swap_id.clone(), ic_cdk::api::time());
//         state_mut.active_swaps.remove(&swap_id);
//         state_mut.secret_store.remove(&swap_id);
//     });
    
//     Ok(SwapExecutionResult {
//         source_transaction: source_tx,
//         dest_transaction: dest_tx,
//         executed_at: ic_cdk::api::time(),
//     })
// }

// ===== EMERGENCY FUNCTIONS =====

#[ic_cdk::update]
pub async fn refund_expired_swap(swap_id: String) -> ResolverResult<String> {
    let swap = STATE.with(|state| {
        state.borrow().active_swaps.get(&swap_id).cloned()
    }).ok_or_else(|| ResolverError::OrderNotFound("Swap not found".to_string()))?;
    
    // Check if timelock has expired
    let current_time = ic_cdk::api::time() / 1_000_000_000;
    if current_time <= swap.timelock {
        return Err(ResolverError::ProcessingError("Swap has not expired yet".to_string()));
    }
    
    let evm_client = get_evm_client();
    
    // Refund both escrows to original depositors
    let mut refund_txs = Vec::new();
    
    if let Some(ref escrow) = swap.source_escrow {
        let tx = evm_client.refund_expired_escrow(escrow).await?;
        refund_txs.push(tx);
    }
    
    if let Some(ref escrow) = swap.dest_escrow {
        let tx = evm_client.refund_expired_escrow(escrow).await?;
        refund_txs.push(tx);
    }
    
    // Clean up state
    STATE.with(|state| {
        let mut state_mut = state.borrow_mut();
        state_mut.active_swaps.remove(&swap_id);
        state_mut.secret_store.remove(&swap_id);
    });
    
    Ok(format!("Refunded: {:?}", refund_txs))
}

// ===== QUERY FUNCTIONS =====

#[ic_cdk::query]
pub fn get_active_swaps() -> Vec<CrossChainSwap> {
    STATE.with(|state| {
        state.borrow().active_swaps.values().cloned().collect()
    })
}

#[ic_cdk::query]
pub fn get_completed_swaps() -> Vec<(String, u64)> {
    STATE.with(|state| {
        state.borrow().completed_swaps.iter().map(|(k, v)| (k.clone(), *v)).collect()
    })
}

#[ic_cdk::update]
pub async fn update_config(config: OrchestratorConfig) -> ResolverResult<()> {
    STATE.with(|state| {
        state.borrow_mut().config = config;
    });
    Ok(())
}

#[ic_cdk::query]
pub fn get_config() -> OrchestratorConfig {
    STATE.with(|state| state.borrow().config.clone())
}

// ===== THRESHOLD ECDSA FUNCTIONS =====

/// Get canister's Ethereum address (derived from threshold ECDSA)
#[ic_cdk::update]
pub async fn get_canister_eth_address() -> ResolverResult<String> {
    let config = STATE.with(|state| state.borrow().config.clone());
    
    let public_key_result = ic_cdk::call(
        Principal::management_canister(),
        "ecdsa_public_key",
        (EcdsaPublicKeyArgs {
            canister_id: None,
            derivation_path: vec![],
            key_id: EcdsaKeyId {
                curve: EcdsaCurve::Secp256k1,
                name: config.ecdsa_key_name,
            },
        },)
    ).await;
    
    match public_key_result {
        Ok((response,)) => {
            let public_key_response: EcdsaPublicKeyResponse = response;
            // Convert public key to Ethereum address
            let eth_address = public_key_to_eth_address(&public_key_response.public_key);
            Ok(eth_address)
        }
        Err((code, msg)) => Err(ResolverError::ExternalCallError(format!(
            "Failed to get public key: {:?} - {}", code, msg
        )))
    }
}

/// Convert public key to Ethereum address
fn public_key_to_eth_address(public_key: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    
    // Remove the first byte (0x04) from uncompressed public key
    let public_key_bytes = &public_key[1..];
    
    // Hash with SHA256 (simplified - would use Keccak256 in real implementation)
    let hash = Sha256::digest(public_key_bytes);
    
    // Take last 20 bytes as Ethereum address
    let address_bytes = &hash[12..];
    format!("0x{}", hex::encode(address_bytes))
}

// ===== ICP ESCROW FACTORY =====

/// Create a new ICP escrow canister for a swap
async fn create_icp_escrow_for_swap(
    swap_id: &str,
    secret_hash: [u8; 32],
    timelock: u64,
    amount: u128,
    token_ledger: Principal,
    depositor: Principal,
    recipient: Principal,
) -> ResolverResult<Principal> {
    let params = IcpEscrowParams {
        secret_hash,
        timelock,
        amount,
        token_ledger,
        depositor,
        recipient,
        resolver: ic_cdk::id(), // This resolver canister controls the escrow
    };
    
    let escrow_canister = deploy_icp_escrow(params).await?;
    
    // Track the created escrow
    STATE.with(|state| {
        let mut state_mut = state.borrow_mut();
        state_mut.created_icp_escrows.insert(swap_id.to_string(), escrow_canister);
        state_mut.escrow_count += 1;
    });
    
    Ok(escrow_canister)
}

/// Get created ICP escrow for a swap
#[ic_cdk::query]
pub fn get_icp_escrow_for_swap(swap_id: String) -> Option<Principal> {
    STATE.with(|state| {
        state.borrow().created_icp_escrows.get(&swap_id).copied()
    })
}

/// Get total number of created escrow canisters
#[ic_cdk::query] 
pub fn get_escrow_count() -> u64 {
    STATE.with(|state| state.borrow().escrow_count)
}

/// List all created ICP escrows
#[ic_cdk::query]
pub fn list_created_icp_escrows() -> Vec<(String, Principal)> {
    STATE.with(|state| {
        state.borrow().created_icp_escrows.iter()
            .map(|(k, v)| (k.clone(), *v))
            .collect()
    })
}

// ===== HELPER FUNCTIONS =====

/// Fund destination escrow via wallet canister
async fn fund_dest_escrow_via_wallet(
    escrow_address: &str,
    token_address: &str,
    amount: u128,
) -> ResolverResult<()> {
    let wallet_canister = STATE.with(|state| state.borrow().wallet_canister)
        .ok_or_else(|| ResolverError::ProcessingError("Wallet canister not set".to_string()))?;
    
    // Call wallet to send tokens to escrow
    let result: Result<(Result<String, String>,), _> = if token_address == "0x0000000000000000000000000000000000000000" {
        // Send ETH
        ic_cdk::call(wallet_canister, "send_eth", (escrow_address.to_string(), amount)).await
    } else {
        // Send ERC20 token
        ic_cdk::call(
            wallet_canister, 
            "send_erc20", 
            (token_address.to_string(), escrow_address.to_string(), amount)
        ).await
    };
    
    match result {
        Ok((Ok(tx_hash),)) => {
            ic_cdk::println!("Funded escrow {} with tx: {}", escrow_address, tx_hash);
            Ok(())
        }
        Ok((Err(error),)) => Err(ResolverError::ExternalCallError(format!("Wallet error: {}", error))),
        Err((code, msg)) => Err(ResolverError::ExternalCallError(format!("Call failed: {:?} - {}", code, msg))),
    }
}

async fn fund_icp_dest_escrow(
    escrow_canister: &Principal,
    token_ledger: &Principal,
    amount: u128,
) -> ResolverResult<()> {
    use ic_ledger_types::{TransferArgs, Tokens, AccountIdentifier, Subaccount, Memo};
    
    let transfer_args = TransferArgs {
        memo: Memo(3),
        amount: Tokens::from_e8s(amount as u64),
        fee: Tokens::from_e8s(10000),
        from_subaccount: None,
        to: AccountIdentifier::new(escrow_canister, &Subaccount([0; 32])),
        created_at_time: None,
    };
    
    let transfer_result: Result<(ic_ledger_types::TransferResult,), _> = ic_cdk::call(
        *token_ledger,
        "transfer",
        (transfer_args,)
    ).await;
    
    match transfer_result {
        Ok((ic_ledger_types::TransferResult::Ok(_),)) => Ok(()),
        Ok((ic_ledger_types::TransferResult::Err(err),)) => {
            Err(ResolverError::ExternalCallError(format!("Transfer failed: {:?}", err)))
        }
        Err((code, msg)) => {
            Err(ResolverError::ExternalCallError(format!("Call failed: {:?} - {}", code, msg)))
        }
    }
}

fn get_evm_client() -> EvmRpcClient {
    let canister_id = STATE.with(|state| state.borrow().config.evm_rpc_canister);
    EvmRpcClient::new(canister_id)
}

/// Configure for Sepolia testnet
#[ic_cdk::update]
pub async fn configure_for_sepolia_testnet() -> ResolverResult<()> {
    let mut config = STATE.with(|state| state.borrow().config.clone());
    
    config.evm_network = EvmNetwork::EthSepolia;
    config.ecdsa_key_name = "test_key_1".to_string();
    config.supported_tokens = vec![
        "0x0000000000000000000000000000000000000000".to_string(), // ETH
    ];
    
    STATE.with(|state| {
        state.borrow_mut().config = config;
    });
    
    Ok(())
}

// ===== CKETH INTEGRATION =====

/// Initiate ETH deposit to get ckETH on ICP (real cross-chain transfer)
#[ic_cdk::update]
pub async fn deposit_eth_for_cketh(
    user_eth_address: String,
    user_icp_principal: String,
    amount: u128,
) -> ResolverResult<String> {
    let cketh_minter_canister = Principal::from_text("jzenf-aiaaa-aaaar-qaa7q-cai") // Sepolia ckETH minter
        .map_err(|e| ResolverError::ProcessingError(format!("Invalid minter principal: {}", e)))?;
    
    let recipient = Principal::from_text(&user_icp_principal)
        .map_err(|e| ResolverError::InvalidInput(format!("Invalid ICP principal: {}", e)))?;
    
    // Call ckETH minter to get deposit address for user
    let result: Result<(Result<String, String>,), _> = ic_cdk::call(
        cketh_minter_canister,
        "get_deposit_address",
        (user_eth_address, recipient)
    ).await;
    
    match result {
        Ok((Ok(deposit_address),)) => Ok(format!(
            "Send {} ETH to deposit address: {} - You will receive ckETH on ICP principal: {}", 
            amount, deposit_address, user_icp_principal
        )),
        Ok((Err(error),)) => Err(ResolverError::ExternalCallError(format!("ckETH minter error: {}", error))),
        Err((code, msg)) => Err(ResolverError::ExternalCallError(format!("Call failed: {:?} - {}", code, msg))),
    }
}

/// Withdraw ckETH to get ETH on Ethereum (real cross-chain transfer)
#[ic_cdk::update]
pub async fn withdraw_cketh_for_eth(
    user_eth_address: String,
    amount: u128,
) -> ResolverResult<String> {
    let cketh_minter_canister = Principal::from_text("jzenf-aiaaa-aaaar-qaa7q-cai")
        .map_err(|e| ResolverError::ProcessingError(format!("Invalid minter principal: {}", e)))?;
    
    // Call ckETH minter to withdraw
    let result: Result<(Result<String, String>,), _> = ic_cdk::call(
        cketh_minter_canister,
        "withdraw_eth",
        (user_eth_address, amount)
    ).await;
    
    match result {
        Ok((Ok(tx_hash),)) => Ok(format!("ETH withdrawal initiated: {}", tx_hash)),
        Ok((Err(error),)) => Err(ResolverError::ExternalCallError(format!("Withdrawal failed: {}", error))),
        Err((code, msg)) => Err(ResolverError::ExternalCallError(format!("Call failed: {:?} - {}", code, msg))),
    }
}

// Export candid interface
ic_cdk::export_candid!();