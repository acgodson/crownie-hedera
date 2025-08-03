use candid::{CandidType, Principal};
use ic_cdk::api::management_canister::ecdsa::{
    ecdsa_public_key, sign_with_ecdsa, EcdsaCurve, EcdsaKeyId, EcdsaPublicKeyArgument,
    SignWithEcdsaArgument,
};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;

mod types;
mod evm_client;

use types::*;
use evm_client::EvmClient;

thread_local! {
    static STATE: RefCell<WalletState> = RefCell::new(WalletState::default());
}

#[derive(Default)]
struct WalletState {
    resolver_principal: Option<Principal>,
    config: WalletConfig,
    eth_address: Option<String>,
}

// ===== INITIALIZATION =====

#[ic_cdk::init]
fn init(resolver_principal: Principal) {
    STATE.with(|state| {
        state.borrow_mut().resolver_principal = Some(resolver_principal);
    });
}

// ===== ACCESS CONTROL =====

fn only_resolver() -> Result<(), String> {
    let caller = ic_cdk::caller();
    STATE.with(|state| {
        let resolver = state.borrow().resolver_principal
            .ok_or("Resolver not set")?;
        if caller != resolver {
            return Err("Only resolver can call this function".to_string());
        }
        Ok(())
    })
}

// ===== THRESHOLD ECDSA FUNCTIONS =====

/// Get this wallet's Ethereum address
#[ic_cdk::update]
pub async fn get_eth_address() -> Result<String, String> {
    // Check if we already have the address cached
    if let Some(address) = STATE.with(|state| state.borrow().eth_address.clone()) {
        return Ok(address);
    }
    
    let config = STATE.with(|state| state.borrow().config.clone());
    
    let public_key_result = ecdsa_public_key(EcdsaPublicKeyArgument {
        canister_id: None,
        derivation_path: vec![],
        key_id: EcdsaKeyId {
            curve: EcdsaCurve::Secp256k1,
            name: config.ecdsa_key_name,
        },
    }).await;
    
    match public_key_result {
        Ok((response,)) => {
            let eth_address = public_key_to_eth_address(&response.public_key);
            
            // Cache the address
            STATE.with(|state| {
                state.borrow_mut().eth_address = Some(eth_address.clone());
            });
            
            Ok(eth_address)
        }
        Err((code, msg)) => Err(format!("Failed to get public key: {:?} - {}", code, msg))
    }
}

/// Convert public key to Ethereum address
fn public_key_to_eth_address(public_key: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    
    // Remove the first byte (0x04) from uncompressed public key  
    let public_key_bytes = &public_key[1..];
    
    // Hash with SHA256 (would use Keccak256 in production)
    let hash = Sha256::digest(public_key_bytes);
    
    // Take last 20 bytes as Ethereum address
    let address_bytes = &hash[12..];
    format!("0x{}", hex::encode(address_bytes))
}

// ===== ETH OPERATIONS =====

/// Get ETH balance of this wallet
#[ic_cdk::update]
pub async fn get_eth_balance() -> Result<u128, String> {
    let eth_address = get_eth_address().await?;
    let evm_client = get_evm_client();
    
    evm_client.get_eth_balance(&eth_address).await
        .map_err(|e| format!("Failed to get ETH balance: {:?}", e))
}

/// Send ETH to an address (only resolver can call)
#[ic_cdk::update]
pub async fn send_eth(to: String, amount: u128) -> Result<String, String> {
    only_resolver()?;
    
    let evm_client = get_evm_client();
    let from_address = get_eth_address().await?;
    
    // Get nonce
    let nonce = evm_client.get_transaction_count(&from_address).await
        .map_err(|e| format!("Failed to get nonce: {:?}", e))?;
    
    // Get gas price
    let gas_price = evm_client.get_gas_price().await
        .map_err(|e| format!("Failed to get gas price: {:?}", e))?;
    
    // Build transaction
    let tx = EthTransaction {
        to: Some(to),
        value: amount,
        gas_limit: 21000, // Standard ETH transfer
        gas_price,
        nonce,
        data: vec![],
    };
    
    // Sign and send transaction
    sign_and_send_transaction(tx).await
}

/// Send ERC20 tokens (only resolver can call)
#[ic_cdk::update]
pub async fn send_erc20(
    token_address: String,
    to: String,
    amount: u128
) -> Result<String, String> {
    only_resolver()?;
    
    let evm_client = get_evm_client();
    let from_address = get_eth_address().await?;
    
    // Get nonce
    let nonce = evm_client.get_transaction_count(&from_address).await
        .map_err(|e| format!("Failed to get nonce: {:?}", e))?;
    
    // Get gas price  
    let gas_price = evm_client.get_gas_price().await
        .map_err(|e| format!("Failed to get gas price: {:?}", e))?;
    
    // Build ERC20 transfer call data
    // transfer(address to, uint256 amount)
    let function_selector = "0xa9059cbb";
    let call_data = format!("{}{}{}",
        function_selector,
        format!("{:0>64}", &to[2..]),           // to address
        format!("{:0>64x}", amount)             // amount
    );
    
    let tx = EthTransaction {
        to: Some(token_address),
        value: 0,
        gas_limit: 60000, // ERC20 transfer
        gas_price,
        nonce,
        data: hex::decode(&call_data[2..]).map_err(|e| format!("Invalid hex: {}", e))?,
    };
    
    sign_and_send_transaction(tx).await
}

/// Get ERC20 token balance
#[ic_cdk::update]
pub async fn get_erc20_balance(token_address: String) -> Result<u128, String> {
    let eth_address = get_eth_address().await?;
    let evm_client = get_evm_client();
    
    evm_client.get_token_balance(&token_address, &eth_address).await
        .map_err(|e| format!("Failed to get token balance: {:?}", e))
}

// ===== SMART CONTRACT INTERACTIONS =====

/// Call smart contract function (only resolver can call)
#[ic_cdk::update]
pub async fn call_contract(
    contract_address: String,
    call_data: String,
    value: u128,
    gas_limit: u64
) -> Result<String, String> {
    only_resolver()?;
    
    let evm_client = get_evm_client();
    let from_address = get_eth_address().await?;
    
    let nonce = evm_client.get_transaction_count(&from_address).await
        .map_err(|e| format!("Failed to get nonce: {:?}", e))?;
    
    let gas_price = evm_client.get_gas_price().await
        .map_err(|e| format!("Failed to get gas price: {:?}", e))?;
    
    let tx = EthTransaction {
        to: Some(contract_address),
        value,
        gas_limit,
        gas_price,
        nonce,
        data: hex::decode(&call_data[2..]).map_err(|e| format!("Invalid hex: {}", e))?,
    };
    
    sign_and_send_transaction(tx).await
}

// ===== TRANSACTION SIGNING =====

async fn sign_and_send_transaction(tx: EthTransaction) -> Result<String, String> {
    let config = STATE.with(|state| state.borrow().config.clone());
    
    // Encode transaction for signing
    let tx_hash = encode_transaction_for_signing(&tx);
    
    // Sign with threshold ECDSA
    let signature_result = sign_with_ecdsa(SignWithEcdsaArgument {
        message_hash: tx_hash,
        derivation_path: vec![],
        key_id: EcdsaKeyId {
            curve: EcdsaCurve::Secp256k1,
            name: config.ecdsa_key_name,
        },
    }).await;
    
    let signature = match signature_result {
        Ok((response,)) => response.signature,
        Err((code, msg)) => return Err(format!("Failed to sign: {:?} - {}", code, msg))
    };
    
    // Encode signed transaction
    let signed_tx = encode_signed_transaction(&tx, &signature);
    
    // Send via EVM RPC
    let evm_client = get_evm_client();
    evm_client.send_raw_transaction(&signed_tx).await
        .map_err(|e| format!("Failed to send transaction: {:?}", e))
}

fn encode_transaction_for_signing(tx: &EthTransaction) -> Vec<u8> {
    // Simplified transaction encoding for demo
    // Production would use proper RLP encoding
    use sha2::{Digest, Sha256};
    
    let mut hasher = Sha256::new();
    hasher.update(tx.nonce.to_be_bytes());
    hasher.update(tx.gas_price.to_be_bytes()); 
    hasher.update(tx.gas_limit.to_be_bytes());
    if let Some(ref to) = tx.to {
        hasher.update(to.as_bytes());
    }
    hasher.update(tx.value.to_be_bytes());
    hasher.update(&tx.data);
    
    hasher.finalize().to_vec()
}

fn encode_signed_transaction(tx: &EthTransaction, signature: &[u8]) -> String {
    // Simplified signed transaction encoding
    // Production would use proper RLP encoding with v, r, s values
    format!("0x{}", hex::encode(signature))
}

// ===== CONFIGURATION =====

#[ic_cdk::update]
pub async fn configure_wallet(config: WalletConfig) -> Result<(), String> {
    only_resolver()?;
    
    STATE.with(|state| {
        state.borrow_mut().config = config;
    });
    
    Ok(())
}

#[ic_cdk::query]
pub fn get_config() -> WalletConfig {
    STATE.with(|state| state.borrow().config.clone())
}

#[ic_cdk::query]
pub fn get_resolver() -> Option<Principal> {
    STATE.with(|state| state.borrow().resolver_principal)
}

// ===== HELPERS =====

fn get_evm_client() -> EvmClient {
    let config = STATE.with(|state| state.borrow().config.clone());
    EvmClient::new(config.evm_rpc_canister, config.evm_network)
}

// Export candid interface
ic_cdk::export_candid!();