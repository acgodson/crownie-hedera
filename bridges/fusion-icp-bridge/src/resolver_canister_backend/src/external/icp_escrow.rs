use candid::{CandidType, Principal, Nat};
use ic_cdk::api::management_canister::main::{CanisterInstallMode, CreateCanisterArgument, CanisterSettings, InstallCodeArgument};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::cell::RefCell;

use crate::types::*;


#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct IcpEscrowParams {
    pub secret_hash: [u8; 32],
    pub timelock: u64,
    pub amount: u128,
    pub token_ledger: Principal,    
    pub depositor: Principal,      
    pub recipient: Principal,      
    pub resolver: Principal,      
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum IcpEscrowStatus {
    Created,     
    Funded,      
    Released,    
    Refunded,   
    Expired,     
}


#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CrossChainSwap {
    pub evm_order_hash: String,
    pub icp_escrow_canister: Option<Principal>,
    pub secret_hash: [u8; 32],
    pub amount: u128,
    pub recipient: Principal,
    pub status: SwapStatus,
    pub created_at: u64,
    pub timelock: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum SwapStatus {
    Created,
    IcpEscrowDeployed,
    IcpEscrowFunded,
    Completed,
    Failed,
}

thread_local! {
    static SWAPS: RefCell<HashMap<String, CrossChainSwap>> = RefCell::new(HashMap::new());
}


pub async fn deploy_icp_escrow(params: IcpEscrowParams) -> ResolverResult<Principal> {
    let escrow_wasm = get_escrow_wasm();
    

    let cycles_for_canister = 2_000_000_000_000u128;
    
    let create_result = ic_cdk::api::management_canister::main::create_canister(
        CreateCanisterArgument { 
            settings: Some(CanisterSettings {
                controllers: Some(vec![ic_cdk::id()]), // Resolver controls the escrow
                compute_allocation: None,
                memory_allocation: Some(Nat::from(1_073_741_824u64)),
                freezing_threshold: Some(Nat::from(2_592_000u64)),
                reserved_cycles_limit: None,
                log_visibility: None,
                wasm_memory_limit: None,
                
            })
        },
        cycles_for_canister,
    ).await;

    let canister_id = match create_result {
        Ok((result,)) => result.canister_id,
        Err((code, msg)) => return Err(ResolverError::ExternalCallError(
            format!("Failed to create escrow canister: {:?} - {}", code, msg)
        )),
    };
    let install_result = ic_cdk::api::management_canister::main::install_code(
        InstallCodeArgument {
            mode: CanisterInstallMode::Install,
            canister_id,
            wasm_module: escrow_wasm,
            arg: candid::encode_one(params).map_err(|e| 
                ResolverError::ProcessingError(format!("Failed to encode escrow params: {}", e))
            )?,
        }
    ).await;

    match install_result {
        Ok(()) => Ok(canister_id),
        Err((code, msg)) => Err(ResolverError::ExternalCallError(
            format!("Failed to install escrow code: {:?} - {}", code, msg)
        )),
    }
}


pub async fn handle_evm_to_icp_swap(
    evm_order_hash: String,
    secret_hash: [u8; 32],
    amount: u128,
    recipient: Principal,
    token_ledger: Principal,
    timelock: u64,
) -> ResolverResult<Principal> {
  

    let escrow_params = IcpEscrowParams {
        secret_hash,
        timelock,
        amount,
        token_ledger,
        depositor: ic_cdk::id(),
        recipient,
        resolver: ic_cdk::id(),
    };


    let escrow_canister = deploy_icp_escrow(escrow_params).await?;


    let swap = CrossChainSwap {
        evm_order_hash: evm_order_hash.clone(),
        icp_escrow_canister: Some(escrow_canister),
        secret_hash,
        amount,
        recipient,
        status: SwapStatus::IcpEscrowDeployed,
        created_at: ic_cdk::api::time() / 1_000_000_000,
        timelock,
    };

    SWAPS.with(|swaps| {
        swaps.borrow_mut().insert(evm_order_hash, swap);
    });

    Ok(escrow_canister)
}


pub async fn fund_icp_escrow(evm_order_hash: &str) -> ResolverResult<String> {
    let escrow_canister = SWAPS.with(|swaps| {
        swaps.borrow().get(evm_order_hash)
            .and_then(|swap| swap.icp_escrow_canister)
    }).ok_or_else(|| ResolverError::ProcessingError("Swap not found".to_string()))?;

    let result: Result<(Result<String, String>,), _> = ic_cdk::call(
        escrow_canister,
        "deposit_tokens",
        ()
    ).await;

    match result {
        Ok((Ok(tx_id),)) => {
            SWAPS.with(|swaps| {
                if let Some(swap) = swaps.borrow_mut().get_mut(evm_order_hash) {
                    swap.status = SwapStatus::IcpEscrowFunded;
                }
            });
            Ok(tx_id)
        }
        Ok((Err(error),)) => Err(ResolverError::ProcessingError(format!("Escrow funding failed: {}", error))),
        Err((code, msg)) => Err(ResolverError::ExternalCallError(
            format!("Failed to fund escrow: {:?} - {}", code, msg)
        )),
    }
}


pub async fn check_icp_escrow_funding(escrow_canister: Principal) -> ResolverResult<bool> {
    let result: Result<(bool,), _> = ic_cdk::call(
        escrow_canister, 
        "is_funded", 
        ()
    ).await;

    match result {
        Ok((is_funded,)) => Ok(is_funded),
        Err((code, msg)) => Err(ResolverError::ExternalCallError(
            format!("Failed to check escrow funding: {:?} - {}", code, msg)
        )),
    }
}


pub async fn release_icp_escrow(
    escrow_canister: Principal, 
    secret: [u8; 32]
) -> ResolverResult<String> {
    let result: Result<(Result<String, String>,), _> = ic_cdk::call(
        escrow_canister,
        "release_with_secret",
        (secret,)
    ).await;

    match result {
        Ok((Ok(tx_id),)) => Ok(tx_id),
        Ok((Err(error),)) => Err(ResolverError::ProcessingError(format!("Escrow release failed: {}", error))),
        Err((code, msg)) => Err(ResolverError::ExternalCallError(
            format!("Failed to release escrow: {:?} - {}", code, msg)
        )),
    }
}

pub async fn refund_icp_escrow(escrow_canister: Principal) -> ResolverResult<String> {
    let result: Result<(Result<String, String>,), _> = ic_cdk::call(
        escrow_canister,
        "refund_expired",
        ()
    ).await;

    match result {
        Ok((Ok(tx_id),)) => Ok(tx_id),
        Ok((Err(error),)) => Err(ResolverError::ProcessingError(format!("Escrow refund failed: {}", error))),
        Err((code, msg)) => Err(ResolverError::ExternalCallError(
            format!("Failed to refund escrow: {:?} - {}", code, msg)
        )),
    }
}


pub async fn get_escrow_secret(escrow_canister: Principal) -> ResolverResult<Option<[u8; 32]>> {
    let result: Result<(Option<[u8; 32]>,), _> = ic_cdk::call(
        escrow_canister,
        "get_secret",
        ()
    ).await;

    match result {
        Ok((secret,)) => Ok(secret),
        Err((code, msg)) => Err(ResolverError::ExternalCallError(
            format!("Failed to get secret: {:?} - {}", code, msg)
        )),
    }
}

pub async fn complete_swap(evm_order_hash: &str, _secret: [u8; 32]) -> ResolverResult<()> {
    SWAPS.with(|swaps| {
        if let Some(swap) = swaps.borrow_mut().get_mut(evm_order_hash) {
            swap.status = SwapStatus::Completed;
        }
    });
    Ok(())
}


pub fn get_swap_status(evm_order_hash: &str) -> Option<SwapStatus> {
    SWAPS.with(|swaps| {
        swaps.borrow().get(evm_order_hash).map(|swap| swap.status.clone())
    })
}


pub fn list_swaps() -> Vec<(String, CrossChainSwap)> {
    SWAPS.with(|swaps| {
        swaps.borrow().iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    })
}


fn get_escrow_wasm() -> Vec<u8> {
    include_bytes!("../../../../target/wasm32-unknown-unknown/release/icp_escrow_canister.wasm").to_vec()
}

