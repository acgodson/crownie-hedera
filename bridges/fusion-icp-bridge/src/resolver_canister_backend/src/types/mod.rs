use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

// Core data structures matching 1inch Fusion+ specifications
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CrossChainOrder {
    pub maker: String,           // Ethereum address
    pub maker_asset: String,     // Token contract address
    pub making_amount: u128,     // Amount being offered
    pub taker_asset: String,     // Desired token contract
    pub taking_amount: u128,     // Amount requested
    pub src_chain_id: u64,       // Source chain ID
    pub dst_chain_id: u64,       // Destination chain ID (ICP)
    pub hash_lock: [u8; 32],     // Secret hash for HTLC
    pub time_lock: u64,          // Expiration timestamp
    pub order_hash: String,      // 1inch order hash
    pub auction_details: AuctionDetails,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AuctionDetails {
    pub duration: u64,           // Auction duration in seconds
    pub start_time: u64,         // Unix timestamp
    pub initial_rate_bump: u32,  // Initial price premium (basis points)
    pub gas_price: u64,          // Gas cost parameters
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct HTLCEscrow {
    pub contract_id: String,
    pub hash_lock: [u8; 32],
    pub time_lock: u64,
    pub amount: u128,
    pub sender: Principal,
    pub recipient: Principal,
    pub status: EscrowStatus,
    pub secret: Option<[u8; 32]>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum EscrowStatus {
    Locked,
    Unlocked,
    Refunded,
    Expired,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EscrowPair {
    pub ethereum_escrow: String,  // Ethereum contract address
    pub icp_escrow: String,       // ICP escrow contract ID
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BidResult {
    pub order_hash: String,
    pub bid_accepted: bool,
    pub profitability_score: f64,
    pub estimated_profit: u128,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ResolverConfig {
    pub min_profit_threshold: u128,
    pub max_gas_price: u64,
    pub supported_tokens: Vec<String>,
    pub evm_rpc_canister: Principal,
    pub oneinch_api_key: Option<String>,
    pub alchemy_api_key: Option<String>,
    pub custom_rpc_url: Option<String>,
}

impl Default for ResolverConfig {
    fn default() -> Self {
        Self {
            min_profit_threshold: 1000000, // 0.001 ETH in wei
            max_gas_price: 50_000_000_000,  // 50 gwei
            supported_tokens: vec![
                "0x0000000000000000000000000000000000000000".to_string(), // ETH
                "0xA0b86a33E6441Fb4c6e62B85f0C6E3dF9C7fE0c5".to_string(), // USDC
            ],
            evm_rpc_canister: Principal::from_text("7hfb6-caaaa-aaaar-qadga-cai").unwrap(),
            oneinch_api_key: None,
            alchemy_api_key: None,
            custom_rpc_url: None,
        }
    }
}

// Error types
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ResolverError {
    InvalidInput(String),
    ExternalCallError(String),
    ProcessingError(String),
    InsufficientCycles(String),
    NetworkError(String),
    ContractError(String),
}

pub type ResolverResult<T> = Result<T, ResolverError>;

// 1inch API response types
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OneInchOrder {
    pub hash: String,
    pub maker: String,
    pub maker_asset: String,
    pub taker_asset: String,
    pub making_amount: String,
    pub taking_amount: String,
    pub salt: String,
    pub receiver: String,
    pub maker_traits: String,
    pub creation_timestamp: u64,
    pub auction_start_date: u64,
    pub auction_duration: u64,
    pub initial_rate_bump: u32,
    pub points: Vec<AuctionPoint>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AuctionPoint {
    pub delay: u64,
    pub coefficient: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OneInchQuoteResponse {
    pub dst_amount: String,
    pub estimated_gas: u64,
    pub gas_price: String,
}

// Profitability analysis types
#[derive(Clone, Debug)]
pub struct ProfitabilityAnalysis {
    pub score: f64,
    pub estimated_profit: u128,
    pub gas_costs: u128,
    pub price_impact: f64,
    pub competition_level: u32,
}