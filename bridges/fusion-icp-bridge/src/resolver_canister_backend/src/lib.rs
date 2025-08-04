mod types;
mod utils;
mod external;

use std::cell::RefCell;
use std::collections::HashMap;
use ic_cdk::export_candid;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

use types::*;
use utils::ResolverUtils;
use external::{EvmRpcClient, IcpEscrowParams, deploy_icp_escrow, check_icp_escrow_funding, release_icp_escrow, refund_icp_escrow};

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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct OrchestratorConfig {
    oneinch_resolver_address: String,
    evm_rpc_canister: Principal,
    supported_chains: Vec<u64>,
    min_profit_threshold: u128,
    ecdsa_key_name: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum FundingStatus {
    NeitherFunded,
    SourceFunded,
    DestFunded,
    BothFunded,
}

impl Default for OrchestratorConfig {
    fn default() -> Self {
        Self {
            oneinch_resolver_address: "0x0000000000000000000000000000000000000000".to_string(),
            evm_rpc_canister: Principal::from_text("7hfb6-caaaa-aaaar-qadga-cai").unwrap(),
            supported_chains: vec![1, 137, 56], // Ethereum, Polygon, BSC
            min_profit_threshold: 1000000000000000u128, 
            ecdsa_key_name: "test_key_1".to_string(),
        }
    }
}

fn get_evm_client() -> EvmRpcClient {
    let config = STATE.with(|state| state.borrow().config.clone());
    EvmRpcClient::new(config.evm_rpc_canister)
}

#[ic_cdk::init]
fn init() {
    STATE.with(|state| {
        let mut state_mut = state.borrow_mut();
        state_mut.config = OrchestratorConfig::default();
    });
}

#[ic_cdk::update]
pub async fn set_wallet_canister(wallet_canister: Principal) -> Result<(), String> {
    STATE.with(|state| {
        let mut state_mut = state.borrow_mut();
        state_mut.wallet_canister = Some(wallet_canister);
    });
    Ok(())
}

#[ic_cdk::update]
pub async fn configure_for_sepolia_testnet() -> Result<(), String> {
    STATE.with(|state| {
        let mut state_mut = state.borrow_mut();
        state_mut.config.oneinch_resolver_address = "0x1111111254eeb25477b68fb85ed929f73a960582".to_string();
        state_mut.config.supported_chains = vec![11155111]; // Sepolia
    });
    Ok(())
}

#[ic_cdk::update]
pub async fn deposit_eth_for_cketh(
    user_eth_address: String,
    user_icp_principal: String,
    amount: u128,
) -> Result<String, String> {
    let cketh_minter = Principal::from_text("jzenf-aiaaa-aaaar-qaa7q-cai")
        .map_err(|e| format!("Invalid ckETH minter principal: {}", e))?;
    
    let user_principal = Principal::from_text(&user_icp_principal)
        .map_err(|e| format!("Invalid user principal: {}", e))?;
    
    let result: Result<(String,), _> = ic_cdk::call(
        cketh_minter,
        "get_deposit_address",
        (user_eth_address.clone(), user_principal)
    ).await;
    
    match result {
        Ok((deposit_address,)) => {
            Ok(format!(
                "Send {} ETH to deposit address: {}. This will mint ckETH to your ICP principal: {}",
                amount as f64 / 1e18,
                deposit_address,
                user_icp_principal
            ))
        }
        Err((code, msg)) => Err(format!("Failed to get deposit address: {:?} - {}", code, msg))
    }
}

#[ic_cdk::update]
pub async fn initiate_evm_to_icp_swap(
    user_eth_address: String,
    user_icp_principal: String,
    source_token: String,        // ETH token address on source chain
    dest_token: String,          // ICP token ledger principal  
    amount: u128,
    timelock_duration: u64,
) -> ResolverResult<SwapInitiationResult> {
    let swap_id = format!("{}-{}", user_eth_address, ic_cdk::api::time());
    let secret = ic_cdk::api::management_canister::main::raw_rand().await
        .map_err(|e| ResolverError::ProcessingError(format!("Failed to generate secret: {:?}", e)))?
        .0.try_into()
        .map_err(|_| ResolverError::ProcessingError("Failed to convert random bytes".to_string()))?;
    
    let secret_hash = ResolverUtils::hash_secret(&secret);
    let timelock = ic_cdk::api::time() / 1_000_000_000 + timelock_duration;
    
    let depositor_principal = Principal::from_text(&user_eth_address)
        .map_err(|e| ResolverError::InvalidInput(format!("Invalid depositor principal: {}", e)))?;
    let recipient_principal = Principal::from_text(&user_icp_principal)
        .map_err(|e| ResolverError::InvalidInput(format!("Invalid recipient principal: {}", e)))?;
    let token_ledger = Principal::from_text(&dest_token)
        .map_err(|e| ResolverError::InvalidInput(format!("Invalid token ledger: {}", e)))?;
    
    let evm_client = get_evm_client();
    
    // 1. Deploy source escrow on EVM (user will fund this)
    let source_escrow = evm_client.deploy_source_escrow(
        &user_eth_address,   
        &source_token,
        amount,
        secret_hash,
        timelock,
    ).await?;
    
    // 2. Deploy destination escrow on ICP (resolver will fund this)
    let dest_escrow_canister = create_icp_escrow_for_swap(
        &swap_id,
        secret_hash,
        timelock,
        amount,
        token_ledger,
        depositor_principal,
        recipient_principal,
    ).await?;
    
    // 3. Store swap state
    let swap = CrossChainSwap {
        swap_id: swap_id.clone(),
        direction: SwapDirection::EvmToIcp,
        user_address: user_eth_address.clone(),
        user_icp_principal,
        source_token: source_token.clone(),
        dest_token,
        amount,
        secret_hash,
        timelock,
        source_escrow: Some(source_escrow.clone()),
        dest_escrow: Some(dest_escrow_canister.to_text()), 
        source_escrow_canister: None,
        status: SwapStatus::EscrowsDeployed,
        secret: Some(secret), 
    };
    
    STATE.with(|state| {
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
    source_token: String,        // ICP token ledger principal
    dest_token: String,          // ETH token address on destination chain
    amount: u128,
    timelock_duration: u64,
) -> ResolverResult<SwapInitiationResult> {
    let swap_id = format!("{}-{}", user_icp_principal, ic_cdk::api::time());
    let secret = ic_cdk::api::management_canister::main::raw_rand().await
        .map_err(|e| ResolverError::ProcessingError(format!("Failed to generate secret: {:?}", e)))?
        .0.try_into()
        .map_err(|_| ResolverError::ProcessingError("Failed to convert random bytes".to_string()))?;
    
    let secret_hash = ResolverUtils::hash_secret(&secret);
    let timelock = ic_cdk::api::time() / 1_000_000_000 + timelock_duration;
    
    let depositor_principal = Principal::from_text(&user_icp_principal)
        .map_err(|e| ResolverError::InvalidInput(format!("Invalid depositor principal: {}", e)))?;
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
        &user_eth_address,  
        &dest_token,
        amount,
        secret_hash,
        timelock,
    ).await?;
    
    // 3. Resolver funds destination escrow with wallet
    fund_dest_escrow_via_wallet(&dest_escrow, &dest_token, amount).await?;
    
    // 4. Store swap state
    let swap = CrossChainSwap {
        swap_id: swap_id.clone(),
        direction: SwapDirection::IcpToEvm,
        user_address: user_eth_address.clone(),
        user_icp_principal,
        source_token: source_token.clone(),
        dest_token,
        amount,
        secret_hash,
        timelock,
        source_escrow: Some(source_escrow_canister.to_text()), // ICP canister principal as string
        dest_escrow: Some(dest_escrow.clone()),
        source_escrow_canister: Some(source_escrow_canister), // actual Principal
        status: SwapStatus::EscrowsDeployed,
        secret: Some(secret),
    };
    
    STATE.with(|state| {
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
        state.borrow().active_swaps.get(&swap_id)
            .cloned()
            .ok_or_else(|| ResolverError::OrderNotFound("Swap not found".to_string()))
    })
}

#[ic_cdk::update]
pub async fn check_escrow_funding(swap_id: String) -> ResolverResult<FundingStatus> {
    let swap = STATE.with(|state| {
        state.borrow().active_swaps.get(&swap_id).cloned()
    }).ok_or_else(|| ResolverError::OrderNotFound("Swap not found".to_string()))?;
    
    let evm_client = get_evm_client();
    
    let (source_funded, dest_funded) = match swap.direction {
        SwapDirection::EvmToIcp => {
            let source_funded = if let Some(ref escrow) = swap.source_escrow {
                evm_client.check_escrow_balance(escrow, swap.amount).await?
            } else { false };
            
            let dest_funded = if let Some(canister_id) = swap.source_escrow_canister {
                check_icp_escrow_funding(canister_id).await?
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
        (false, false) => FundingStatus::NeitherFunded,
        (true, false) => FundingStatus::SourceFunded,
        (false, true) => FundingStatus::DestFunded,
        (true, true) => {
            // Update swap status to ready
            STATE.with(|state| {
                if let Some(swap) = state.borrow_mut().active_swaps.get_mut(&swap_id) {
                    swap.status = SwapStatus::ReadyForExecution;
                }
            });
            FundingStatus::BothFunded
        }
    };
    
    Ok(status)
}

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
    
    // Handle source escrow refund based on swap direction
    match swap.direction {
        SwapDirection::EvmToIcp => {
            // Source is EVM escrow, dest is ICP escrow
            if let Some(ref escrow) = swap.source_escrow {
                // Reconstruct immutables for EVM escrow refund
                let order_hash = evm_client.generate_order_hash(
                    &swap.user_address,
                    &swap.source_token,
                    swap.amount,
                    swap.secret_hash
                ).await?;
                
                let immutables = evm_client.build_immutables(
                    &order_hash,
                    swap.secret_hash,
                    &swap.user_address,
                    &evm_client.get_resolver_eth_address().await?,
                    &swap.source_token,
                    swap.amount,
                    swap.timelock,
                ).await?;
                
                let tx = evm_client.refund_expired_escrow(escrow, &immutables).await?;
                refund_txs.push(tx);
            }
            
            if let Some(canister_id) = swap.source_escrow_canister {
                let tx = refund_icp_escrow(canister_id).await?;
                refund_txs.push(tx);
            }
        }
        SwapDirection::IcpToEvm => {
            // Source is ICP escrow, dest is EVM escrow
            if let Some(canister_id) = swap.source_escrow_canister {
                let tx = refund_icp_escrow(canister_id).await?;
                refund_txs.push(tx);
            }
            
            if let Some(ref escrow) = swap.dest_escrow {
                // Reconstruct immutables for EVM escrow refund
                let order_hash = evm_client.generate_order_hash(
                    &evm_client.get_resolver_eth_address().await?,
                    &swap.dest_token,
                    swap.amount,
                    swap.secret_hash
                ).await?;
                
                let immutables = evm_client.build_immutables(
                    &order_hash,
                    swap.secret_hash,
                    &evm_client.get_resolver_eth_address().await?,
                    &swap.user_address,
                    &swap.dest_token,
                    swap.amount,
                    swap.timelock,
                ).await?;
                
                let tx = evm_client.refund_expired_escrow(escrow, &immutables).await?;
                refund_txs.push(tx);
            }
        }
    }
    
    // Clean up state
    STATE.with(|state| {
        let mut state_mut = state.borrow_mut();
        state_mut.active_swaps.remove(&swap_id);
        state_mut.secret_store.remove(&swap_id);
    });
    
    Ok(format!("Refunded expired swap with transactions: {:?}", refund_txs))
}

// ===== WALLET INTEGRATION =====

async fn fund_dest_escrow_via_wallet(
    escrow_address: &str,
    token_address: &str,
    amount: u128,
) -> ResolverResult<()> {
    let wallet_canister = STATE.with(|state| state.borrow().wallet_canister)
        .ok_or_else(|| ResolverError::ProcessingError("Wallet canister not set".to_string()))?;
    
    let result: Result<(Result<String, String>,), _> = if token_address == "0x0000000000000000000000000000000000000000" {
        ic_cdk::call(wallet_canister, "send_eth", (escrow_address.to_string(), amount)).await
    } else {
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
        Ok((Err(error),)) => Err(ResolverError::ProcessingError(format!("Wallet funding failed: {}", error))),
        Err((code, msg)) => Err(ResolverError::ExternalCallError(
            format!("Failed to call wallet: {:?} - {}", code, msg)
        )),
    }
}

// ===== QUERY FUNCTIONS =====

#[ic_cdk::query]
pub fn get_active_swaps() -> Vec<(String, CrossChainSwap)> {
    STATE.with(|state| {
        state.borrow().active_swaps.iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    })
}

#[ic_cdk::query]
pub fn get_config() -> OrchestratorConfig {
    STATE.with(|state| state.borrow().config.clone())
}

#[ic_cdk::update]
pub async fn set_resolver_address(address: String) -> Result<(), String> {
    STATE.with(|state| {
        let mut state_mut = state.borrow_mut();
        state_mut.config.oneinch_resolver_address = address;
    });
    Ok(())
}

// ===== ECDSA ADDRESS DERIVATION =====

#[ic_cdk::update]
pub async fn get_resolver_eth_address() -> ResolverResult<String> {
    let public_key_result: Result<(ic_cdk::api::management_canister::ecdsa::EcdsaPublicKeyResponse,), _> = ic_cdk::call(
        Principal::management_canister(),
        "ecdsa_public_key",
        (ic_cdk::api::management_canister::ecdsa::EcdsaPublicKeyArgument {
            canister_id: None,
            derivation_path: vec![],
            key_id: ic_cdk::api::management_canister::ecdsa::EcdsaKeyId {
                curve: ic_cdk::api::management_canister::ecdsa::EcdsaCurve::Secp256k1,
                name: "test_key_1".to_string(),
            },
        },)
    ).await;
    
    match public_key_result {
        Ok((response,)) => {
            let eth_address = public_key_to_eth_address(&response.public_key);
            Ok(eth_address)
        }
        Err((code, msg)) => Err(ResolverError::ExternalCallError(format!(
            "Failed to get public key: {:?} - {}", code, msg
        )))
    }
}


fn public_key_to_eth_address(public_key: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    
    let public_key_bytes = &public_key[1..];
    
    let hash = Sha256::digest(public_key_bytes);
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
        resolver: ic_cdk::id(), 
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

// export_candid!(); // Commented out for testing - enable when building for production

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    // Helper function to reset state for tests
    fn reset_state() {
        STATE.with(|state| {
            *state.borrow_mut() = ResolverOrchestrator::default();
        });
    }

    #[test]
    fn test_default_config() {
        reset_state();
        let config = get_config();
        assert_eq!(config.oneinch_resolver_address, "0x0000000000000000000000000000000000000000");
        assert_eq!(config.supported_chains, vec![1, 137, 56]);
    }

    #[test]
    fn test_set_wallet_canister() {
        reset_state();
        let test_principal = Principal::from_text("be2us-64aaa-aaaaa-qaabq-cai").unwrap();
        
        STATE.with(|state| {
            let mut state_mut = state.borrow_mut();
            state_mut.wallet_canister = Some(test_principal);
        });
        
        let wallet = STATE.with(|state| state.borrow().wallet_canister);
        assert_eq!(wallet, Some(test_principal));
    }

    #[test]
    fn test_configure_for_sepolia() {
        reset_state();
        
        STATE.with(|state| {
            let mut state_mut = state.borrow_mut();
            state_mut.config.oneinch_resolver_address = "0x1111111254eeb25477b68fb85ed929f73a960582".to_string();
            state_mut.config.supported_chains = vec![11155111];
        });
        
        let config = get_config();
        assert_eq!(config.oneinch_resolver_address, "0x1111111254eeb25477b68fb85ed929f73a960582");
        assert_eq!(config.supported_chains, vec![11155111]);
    }

    #[test]
    fn test_swap_creation() {
        reset_state();
        
        let swap = CrossChainSwap {
            swap_id: "test-swap-1".to_string(),
            direction: SwapDirection::EvmToIcp,
            user_address: "0x742d35cc6435c7a0c9bb8cb2de6bb7eac81b9e8c".to_string(),
            user_icp_principal: "be2us-64aaa-aaaaa-qaabq-cai".to_string(),
            source_token: "0x0000000000000000000000000000000000000000".to_string(),
            dest_token: "jzenf-aiaaa-aaaar-qaa7q-cai".to_string(),
            amount: 1000000000000000000u128, // 1 ETH
            secret_hash: [0u8; 32],
            timelock: 1234567890,
            source_escrow: Some("0xabc123...".to_string()),
            dest_escrow: Some("def456-cai".to_string()),
            source_escrow_canister: None,
            status: SwapStatus::EscrowsDeployed,
            secret: Some([1u8; 32]),
        };
        
        STATE.with(|state| {
            state.borrow_mut().active_swaps.insert("test-swap-1".to_string(), swap.clone());
        });
        
        let retrieved_swap = get_swap_details("test-swap-1".to_string()).unwrap();
        assert_eq!(retrieved_swap.swap_id, "test-swap-1");
        assert_eq!(retrieved_swap.amount, 1000000000000000000u128);
        assert_eq!(retrieved_swap.direction, SwapDirection::EvmToIcp);
    }

    #[test]
    fn test_swap_not_found() {
        reset_state();
        
        let result = get_swap_details("non-existent-swap".to_string());
        assert!(result.is_err());
        
        if let Err(ResolverError::OrderNotFound(_)) = result {
            // Expected error type
        } else {
            panic!("Expected OrderNotFound error");
        }
    }

    #[test]
    fn test_active_swaps_listing() {
        reset_state();
        
        let swap1 = CrossChainSwap {
            swap_id: "swap-1".to_string(),
            direction: SwapDirection::EvmToIcp,
            user_address: "0x111".to_string(),
            user_icp_principal: "be2us-64aaa-aaaaa-qaabq-cai".to_string(),
            source_token: "0x0000000000000000000000000000000000000000".to_string(),
            dest_token: "jzenf-aiaaa-aaaar-qaa7q-cai".to_string(),
            amount: 1000000000000000000u128,
            secret_hash: [0u8; 32],
            timelock: 1234567890,
            source_escrow: Some("0xabc1".to_string()),
            dest_escrow: Some("def1-cai".to_string()),
            source_escrow_canister: None,
            status: SwapStatus::EscrowsDeployed,
            secret: Some([1u8; 32]),
        };

        let swap2 = CrossChainSwap {
            swap_id: "swap-2".to_string(),
            direction: SwapDirection::IcpToEvm,
            user_address: "0x222".to_string(),
            user_icp_principal: "be2us-64aaa-aaaaa-qaabq-cai".to_string(),
            source_token: "jzenf-aiaaa-aaaar-qaa7q-cai".to_string(),
            dest_token: "0x0000000000000000000000000000000000000000".to_string(),
            amount: 2000000000000000000u128,
            secret_hash: [1u8; 32],
            timelock: 1234567891,
            source_escrow: Some("icp1-cai".to_string()),
            dest_escrow: Some("0xdef2".to_string()),
            source_escrow_canister: Some(Principal::from_text("be2us-64aaa-aaaaa-qaabq-cai").unwrap()),
            status: SwapStatus::ReadyForExecution,
            secret: Some([2u8; 32]),
        };
        
        STATE.with(|state| {
            let mut state_mut = state.borrow_mut();
            state_mut.active_swaps.insert("swap-1".to_string(), swap1);
            state_mut.active_swaps.insert("swap-2".to_string(), swap2);
        });
        
        let active_swaps = get_active_swaps();
        assert_eq!(active_swaps.len(), 2);
        
        let swap_ids: Vec<String> = active_swaps.iter().map(|(id, _)| id.clone()).collect();
        assert!(swap_ids.contains(&"swap-1".to_string()));
        assert!(swap_ids.contains(&"swap-2".to_string()));
    }

    #[test]
    fn test_escrow_count_tracking() {
        reset_state();
        
        let initial_count = get_escrow_count();
        assert_eq!(initial_count, 0);
        
        // Simulate creating escrows
        STATE.with(|state| {
            let mut state_mut = state.borrow_mut();
            state_mut.escrow_count = 3;
            state_mut.created_icp_escrows.insert(
                "swap-1".to_string(), 
                Principal::from_text("be2us-64aaa-aaaaa-qaabq-cai").unwrap()
            );
        });
        
        let count = get_escrow_count();
        assert_eq!(count, 3);
        
        let escrows = list_created_icp_escrows();
        assert_eq!(escrows.len(), 1);
        assert_eq!(escrows[0].0, "swap-1");
    }

    #[test]
    fn test_public_key_to_eth_address() {
        let test_public_key = vec![
            4, 
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
            17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
            33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
            49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64,
        ];
        
        let eth_address = public_key_to_eth_address(&test_public_key);
        assert!(eth_address.starts_with("0x"));
        assert_eq!(eth_address.len(), 42); // 0x + 40 hex chars
    }

    #[test]
    fn test_funding_status_logic() {
        let test_cases = vec![
            (false, false, "NeitherFunded"),
            (true, false, "SourceFunded"),
            (false, true, "DestFunded"),
            (true, true, "BothFunded"),
        ];
        
        for (source_funded, dest_funded, expected_status) in test_cases {
            let status = match (source_funded, dest_funded) {
                (false, false) => "NeitherFunded",
                (true, false) => "SourceFunded",
                (false, true) => "DestFunded",
                (true, true) => "BothFunded",
            };
            
            assert_eq!(status, expected_status);
        }
    }
}