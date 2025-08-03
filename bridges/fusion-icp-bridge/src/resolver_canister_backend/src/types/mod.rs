use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};


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
    pub receiver: String,        // ICP Principal as string (from frontend)
    pub auction_details: AuctionDetails,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AuctionDetails {
    pub duration: u64,           // Auction duration in seconds
    pub start_time: u64,         // Unix timestamp
    pub initial_rate_bump: u32,  // Initial price premium (basis points)
    pub gas_price: u64,          // Gas cost parameters
}

// Enhanced Fusion+ specific types
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FusionOrderParams {
    pub maker_asset: String,
    pub taker_asset: String,
    pub amount: String,
    pub taker: String,
    pub maker: String,
    pub allowed_sender: Option<String>,
    pub making_amount: String,
    pub taking_amount: String,
    pub predicate: Option<String>,
    pub permit: Option<String>,
    pub interactions: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FusionQuoteParams {
    pub from_token_address: String,
    pub to_token_address: String,
    pub amount: String,
    pub wallet_address: String,
    pub slippage_percentage: Option<f64>,
    pub fee_percent: Option<f64>,
    pub is_permit2: Option<bool>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OrderStatus {
    pub status: String,           // "active", "filled", "cancelled", "expired"
    pub filled_at: Option<u64>,
    pub cancelled_at: Option<u64>,
    pub expires_at: u64,
    pub remaining_making_amount: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SettlementData {
    pub tx_hash: String,
    pub block_number: u64,
    pub gas_used: u64,
    pub gas_price: String,
    pub effective_gas_price: String,
    pub status: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChainConfig {
    pub chain_id: u64,
    pub rpc_url: String,
    pub explorer_url: String,
    pub native_currency: String,
    pub block_time: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BridgeConfig {
    pub source_chain: ChainConfig,
    pub destination_chain: ChainConfig,
    pub bridge_contract: String,
    pub min_confirmation_blocks: u64,
    pub max_gas_limit: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GasEstimate {
    pub gas_limit: u64,
    pub gas_price: String,
    pub total_cost: String,
    pub is_estimate: bool,
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
    SourceDeployed,
    BothDeployed,
    Completed,
    Cancelled,
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
    pub bridge_config: Option<BridgeConfig>,
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
            bridge_config: None,
        }
    }
}


#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ResolverError {
    InvalidInput(String),
    ExternalCallError(String),
    ProcessingError(String),
    InsufficientCycles(String),
    NetworkError(String),
    ContractError(String),
    OrderNotFound(String),
    InsufficientLiquidity(String),
    SlippageExceeded(String),
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
    pub status: Option<OrderStatus>,
    pub settlement: Option<SettlementData>,
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
    pub guaranteed_price: Option<String>,
    pub sources: Option<Vec<QuoteSource>>,
    pub price_impact: Option<f64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct QuoteSource {
    pub name: String,
    pub proportion: String,
}


#[derive(Clone, Debug)]
pub struct ProfitabilityAnalysis {
    pub score: f64,
    pub estimated_profit: u128,
    pub gas_costs: u128,
    pub price_impact: f64,
    pub competition_level: u32,
}


#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<[u8; 32]>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TransferArg {
    pub from_subaccount: Option<[u8; 32]>,
    pub to: Account,
    pub amount: u128,
    pub fee: Option<u128>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum TransferError {
    BadFee { expected_fee: u128 },
    BadBurn { min_burn_amount: u128 },
    InsufficientFunds { balance: u128 },
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: u128 },
    TemporarilyUnavailable,
    GenericError { error_code: u128, message: String },
}

// Cross-chain swap orchestration types
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CrossChainSwap {
    pub swap_id: String,
    pub direction: SwapDirection,
    pub user_address: String,           // ETH address
    pub user_icp_principal: String,     // ICP principal as string
    pub source_token: String,           // Token contract address
    pub dest_token: String,             // Token contract address
    pub amount: u128,
    pub secret_hash: [u8; 32],
    pub timelock: u64,
    pub source_escrow: Option<String>,  // EVM escrow contract address OR ICP canister principal
    pub dest_escrow: Option<String>,    // EVM escrow contract address
    pub source_escrow_canister: Option<Principal>, // ICP escrow canister (for ICP->EVM swaps)
    pub status: SwapStatus,
    pub secret: Option<[u8; 32]>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum SwapDirection {
    EvmToIcp,
    IcpToEvm,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum SwapStatus {
    EscrowsDeployed,
    ReadyForExecution,
    Completed,
    Expired,
    Refunded,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum EscrowFundingStatus {
    NeitherFunded,
    SourceFunded,
    DestFunded,
    BothFunded,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SwapExecutionResult {
    pub source_transaction: String,
    pub dest_transaction: String,
    pub executed_at: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OrchestratorConfig {
    pub evm_rpc_canister: Principal,
    pub evm_network: EvmNetwork,           // Configurable network
    pub wrapper_contract_address: String,  // Our wrapper contract on EVM
    pub wicp_token_address: String,         // WICP token address
    pub supported_tokens: Vec<String>,      // ETH, USDC, etc.
    pub default_timelock: u64,              // Default timelock duration
    pub ecdsa_key_name: String,            // Key for threshold ECDSA
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum EvmNetwork {
    EthMainnet,
    EthSepolia,
    Polygon,
    Base,
    Custom { chain_id: u64, rpc_url: String },
}

impl Default for OrchestratorConfig {
    fn default() -> Self {
        Self {
            evm_rpc_canister: Principal::from_text("7hfb6-caaaa-aaaar-qadga-cai").unwrap(),
            evm_network: EvmNetwork::EthSepolia, // Default to testnet
            wrapper_contract_address: "0x0000000000000000000000000000000000000000".to_string(),
            wicp_token_address: "0x0000000000000000000000000000000000000000".to_string(),
            supported_tokens: vec![
                "0x0000000000000000000000000000000000000000".to_string(), // ETH
                "0xA0b86a33E6441Fb4c6e62B85f0C6E3dF9C7fE0c5".to_string(), // USDC
            ],
            default_timelock: 3600, // 1 hour  
            ecdsa_key_name: "dfx_test_key".to_string(), // Test key
        }
    }
}

// Threshold ECDSA types (following ICP patterns)
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct EcdsaPublicKeyArgs {
    pub canister_id: Option<Principal>,
    pub derivation_path: Vec<Vec<u8>>,
    pub key_id: EcdsaKeyId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct EcdsaKeyId {
    pub curve: EcdsaCurve,
    pub name: String,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum EcdsaCurve {
    #[serde(rename = "secp256k1")]
    Secp256k1,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct EcdsaPublicKeyResponse {
    pub public_key: Vec<u8>,
    pub chain_code: Vec<u8>,
}

// Swap initiation result
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SwapInitiationResult {
    pub swap_id: String,
    pub source_escrow_address: String,  // User sends tokens here
    pub dest_escrow_address: String,    // Resolver funds this
    pub funding_instructions: FundingInstructions,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FundingInstructions {
    pub user_action: String,            // "Send X ETH to source_escrow_address"
    pub required_amount: u128,
    pub token_address: String,
    pub deadline: u64,                  // Timelock expiration
}