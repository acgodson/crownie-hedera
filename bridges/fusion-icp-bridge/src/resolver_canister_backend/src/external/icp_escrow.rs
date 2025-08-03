use candid::{CandidType, Principal};
use ic_cdk::api::management_canister::main::{CanisterInstallMode, CreateCanisterArgument, CanisterSettings, InstallCodeArgument};
use serde::{Deserialize, Serialize};

use crate::types::*;

/// ICP Escrow implementation mirroring 1inch EVM escrow logic
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct IcpEscrowParams {
    pub secret_hash: [u8; 32],
    pub timelock: u64,
    pub amount: u128,
    pub token_ledger: Principal,    // ICRC-1 ledger canister
    pub depositor: Principal,       // Who will deposit tokens
    pub recipient: Principal,       // Who will receive tokens
    pub resolver: Principal,        // Resolver canister (can release with secret)
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum IcpEscrowStatus {
    Created,      // Escrow created, waiting for deposit
    Funded,       // Tokens deposited, ready for release
    Released,     // Tokens released to recipient
    Refunded,     // Tokens refunded to depositor (after timelock)
    Expired,      // Timelock expired
}

/// Deploy a new ICP escrow canister (factory pattern)
pub async fn deploy_icp_escrow(params: IcpEscrowParams) -> ResolverResult<Principal> {
    let escrow_wasm = get_escrow_wasm();
    
    let cycles_for_canister = 1_000_000_000_000u128;
    
    let create_result = ic_cdk::api::management_canister::main::create_canister(
        CreateCanisterArgument { 
            settings: Some(CanisterSettings {
                controllers: Some(vec![ic_cdk::id()]), 
                compute_allocation: None,
                memory_allocation: None,
                freezing_threshold: None,
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

fn get_escrow_wasm() -> Vec<u8> {
    include_bytes!("../../../../target/wasm32-unknown-unknown/release/icp_escrow_canister.wasm").to_vec()
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

/// Refund expired ICP escrow (anyone can call after timelock)
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