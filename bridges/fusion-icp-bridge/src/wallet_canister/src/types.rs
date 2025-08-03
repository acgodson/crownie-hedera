use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct WalletConfig {
    pub evm_rpc_canister: Principal,
    pub evm_network: EvmNetwork,
    pub ecdsa_key_name: String,
}

impl Default for WalletConfig {
    fn default() -> Self {
        Self {
            evm_rpc_canister: Principal::from_text("7hfb6-caaaa-aaaar-qadga-cai").unwrap(),
            evm_network: EvmNetwork::EthSepolia,
            ecdsa_key_name: "test_key_1".to_string(),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum EvmNetwork {
    EthMainnet,
    EthSepolia,
    Polygon,
    Base,
    Custom { chain_id: u64, rpc_url: String },
}

#[derive(Clone, Debug)]
pub struct EthTransaction {
    pub to: Option<String>,
    pub value: u128,
    pub gas_limit: u64,
    pub gas_price: u128,
    pub nonce: u64,
    pub data: Vec<u8>,
}

// Error types
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum WalletError {
    InvalidInput(String),
    ExternalCallError(String),
    ProcessingError(String),
    UnauthorizedAccess(String),
}

pub type WalletResult<T> = Result<T, WalletError>;