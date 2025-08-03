use candid::{CandidType, Principal};
use ic_cdk::api::time;
use ic_ledger_types::{TransferArgs, TransferResult, Tokens, AccountIdentifier, Subaccount, Memo, MAINNET_LEDGER_CANISTER_ID};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;

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
    Created,      // Escrow created, waiting for deposit
    Funded,       // Tokens deposited, ready for release
    Released,     // Tokens released to recipient
    Refunded,     // Tokens refunded to depositor (after timelock)
    Expired,      // Timelock expired
}

impl Default for IcpEscrowStatus {
    fn default() -> Self {
        IcpEscrowStatus::Created
    }
}

#[derive(Default)]
struct EscrowState {
    params: Option<IcpEscrowParams>,
    deposited_amount: u128,
    status: IcpEscrowStatus,
    secret: Option<[u8; 32]>,
}

thread_local! {
    static STATE: RefCell<EscrowState> = RefCell::new(EscrowState {
        params: None,
        deposited_amount: 0,
        status: IcpEscrowStatus::Created,
        secret: None,
    });
}



#[ic_cdk::init]
fn init(params: IcpEscrowParams) {
    STATE.with(|state| {
        let mut state_mut = state.borrow_mut();
        state_mut.params = Some(params);
        state_mut.status = IcpEscrowStatus::Created;
    });
}



fn only_resolver() -> Result<(), String> {
    let caller = ic_cdk::caller();
    STATE.with(|state| {
        let params = state.borrow().params.as_ref()
            .ok_or("Escrow not initialized")?
            .clone();
        if caller != params.resolver {
            return Err("Only resolver can call this function".to_string());
        }
        Ok(())
    })
}

fn only_depositor() -> Result<(), String> {
    let caller = ic_cdk::caller();
    STATE.with(|state| {
        let params = state.borrow().params.as_ref()
            .ok_or("Escrow not initialized")?
            .clone();
        if caller != params.depositor {
            return Err("Only depositor can call this function".to_string());
        }
        Ok(())
    })
}

// ===== CORE ESCROW FUNCTIONS =====

/// Deposit tokens to this escrow (depositor calls this)
#[ic_cdk::update]
pub async fn deposit_tokens(amount: u128) -> Result<String, String> {
    only_depositor()?;
    
    let params = STATE.with(|state| {
        state.borrow().params.clone()
            .ok_or("Escrow not initialized".to_string())
    })?;
    
    if amount != params.amount {
        return Err(format!("Amount {} doesn't match expected {}", amount, params.amount));
    }
    
    let current_status = STATE.with(|state| state.borrow().status.clone());
    if current_status != IcpEscrowStatus::Created {
        return Err("Escrow not in Created state".to_string());
    }
    
        let transfer_args = TransferArgs {
        memo: Memo(0),
        amount: Tokens::from_e8s(amount as u64),
        fee: Tokens::from_e8s(10000), // Standard ICP fee
        from_subaccount: None,
        to: AccountIdentifier::new(&ic_cdk::id(), &Subaccount([0; 32])),
        created_at_time: None,
    };
    
    let transfer_result: Result<(TransferResult,), _> = ic_cdk::call(
        params.token_ledger,
        "transfer",
        (transfer_args,)
    ).await;
    
    match transfer_result {
        Ok((TransferResult::Ok(block_height),)) => {
            STATE.with(|state| {
                let mut state_mut = state.borrow_mut();
                state_mut.deposited_amount = amount;
                state_mut.status = IcpEscrowStatus::Funded;
            });
            Ok(format!("Deposited {} tokens at block {}", amount, block_height))
        }
        Ok((TransferResult::Err(err),)) => Err(format!("Transfer failed: {:?}", err)),
        Err((code, msg)) => Err(format!("Call failed: {:?} - {}", code, msg)),
    }
}

/// Release tokens with secret (resolver calls this)
#[ic_cdk::update]
pub async fn release_with_secret(secret: [u8; 32]) -> Result<String, String> {
    only_resolver()?;
    
    let params = STATE.with(|state| {
        state.borrow().params.clone()
            .ok_or("Escrow not initialized".to_string())
    })?;
    
    // Verify secret hash
    use sha2::{Digest, Sha256};
    let computed_hash = Sha256::digest(&secret);
    if computed_hash.as_slice() != params.secret_hash {
        return Err("Invalid secret".to_string());
    }
    
    // Check status and timelock
    let (current_status, deposited_amount) = STATE.with(|state| {
        let state_ref = state.borrow();
        (state_ref.status.clone(), state_ref.deposited_amount)
    });
    
    if current_status != IcpEscrowStatus::Funded {
        return Err("Escrow not funded".to_string());
    }
    
    let current_time = time() / 1_000_000_000; // Convert to seconds
    if current_time >= params.timelock {
        return Err("Timelock expired".to_string());
    }
    
    // Transfer tokens to recipient
    let transfer_args = TransferArgs {
        memo: Memo(1), // Different memo for release
        amount: Tokens::from_e8s(deposited_amount as u64),
        fee: Tokens::from_e8s(10000),
        from_subaccount: None,
        to: AccountIdentifier::new(&params.recipient, &Subaccount([0; 32])),
        created_at_time: None,
    };
    
    let transfer_result: Result<(TransferResult,), _> = ic_cdk::call(
        params.token_ledger,
        "transfer",
        (transfer_args,)
    ).await;
    
    match transfer_result {
        Ok((TransferResult::Ok(block_height),)) => {
            STATE.with(|state| {
                let mut state_mut = state.borrow_mut();
                state_mut.status = IcpEscrowStatus::Released;
                state_mut.secret = Some(secret);
            });
            Ok(format!("Released {} tokens to recipient at block {}", deposited_amount, block_height))
        }
        Ok((TransferResult::Err(err),)) => Err(format!("Transfer failed: {:?}", err)),
        Err((code, msg)) => Err(format!("Call failed: {:?} - {}", code, msg)),
    }
}

/// Refund tokens after timelock expires (anyone can call)
#[ic_cdk::update]
pub async fn refund_expired() -> Result<String, String> {
    let params = STATE.with(|state| {
        state.borrow().params.clone()
            .ok_or("Escrow not initialized".to_string())
    })?;
    
    // Check timelock
    let current_time = time() / 1_000_000_000;
    if current_time < params.timelock {
        return Err("Timelock not yet expired".to_string());
    }
    
    let (current_status, deposited_amount) = STATE.with(|state| {
        let state_ref = state.borrow();
        (state_ref.status.clone(), state_ref.deposited_amount)
    });
    
    if current_status != IcpEscrowStatus::Funded {
        return Err("Escrow not funded".to_string());
    }
    
    // Refund tokens to original depositor
    let transfer_args = TransferArgs {
        memo: Memo(2), // Different memo for refund
        amount: Tokens::from_e8s(deposited_amount as u64),
        fee: Tokens::from_e8s(10000),
        from_subaccount: None,
        to: AccountIdentifier::new(&params.depositor, &Subaccount([0; 32])),
        created_at_time: None,
    };
    
    let transfer_result: Result<(TransferResult,), _> = ic_cdk::call(
        params.token_ledger,
        "transfer",
        (transfer_args,)
    ).await;
    
    match transfer_result {
        Ok((TransferResult::Ok(block_height),)) => {
            STATE.with(|state| {
                state.borrow_mut().status = IcpEscrowStatus::Refunded;
            });
            Ok(format!("Refunded {} tokens to depositor at block {}", deposited_amount, block_height))
        }
        Ok((TransferResult::Err(err),)) => Err(format!("Transfer failed: {:?}", err)),
        Err((code, msg)) => Err(format!("Call failed: {:?} - {}", code, msg)),
    }
}



#[ic_cdk::query]
pub fn get_status() -> IcpEscrowStatus {
    STATE.with(|state| state.borrow().status.clone())
}

#[ic_cdk::query]
pub fn get_params() -> Option<IcpEscrowParams> {
    STATE.with(|state| state.borrow().params.clone())
}

#[ic_cdk::query]
pub fn get_deposited_amount() -> u128 {
    STATE.with(|state| state.borrow().deposited_amount)
}

#[ic_cdk::query]
pub fn is_funded() -> bool {
    STATE.with(|state| state.borrow().status == IcpEscrowStatus::Funded)
}

#[ic_cdk::query]
pub fn get_secret() -> Option<[u8; 32]> {
    STATE.with(|state| state.borrow().secret)
}

#[ic_cdk::query]
pub fn get_account_identifier() -> String {
    AccountIdentifier::new(&ic_cdk::id(), &Subaccount([0; 32])).to_string()
}

#[ic_cdk::query]
pub fn get_balance() -> u128 {
    STATE.with(|state| state.borrow().deposited_amount)
}

ic_cdk::export_candid!();