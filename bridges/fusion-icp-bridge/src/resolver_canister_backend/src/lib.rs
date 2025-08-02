use candid::Principal;
use ic_cdk::api::call::call_with_payment;
use ic_cdk::api::management_canister::http_request::{HttpResponse, TransformArgs};
use std::cell::RefCell;
use std::collections::HashMap;

mod types;
mod utils;
mod external;

use types::*;
use utils::ResolverUtils;
use external::{HttpClient, EvmRpcClient};

// Thread-local storage for canister state
thread_local! {
    static STATE: RefCell<ResolverState> = RefCell::new(ResolverState::default());
}

#[derive(Default)]
struct ResolverState {
    active_orders: HashMap<String, CrossChainOrder>,
    active_escrows: HashMap<String, HTLCEscrow>,
    completed_swaps: HashMap<String, u64>,
    resolver_config: ResolverConfig,
}

// Core resolver functions
#[ic_cdk::update]
pub async fn derive_icp_principal(eth_address: String) -> ResolverResult<Principal> {
    ResolverUtils::derive_icp_principal(&eth_address)
}

#[ic_cdk::query]
pub fn get_active_orders_status() -> Vec<CrossChainOrder> {
    // Returns orders currently being processed by this resolver
    STATE.with(|state| {
        let orders = state.borrow().active_orders.values().cloned().collect();
        orders
    })
}

#[ic_cdk::update]
pub async fn evaluate_and_bid_orders() -> ResolverResult<Vec<BidResult>> {
    let mut results = Vec::new();
    
    // Get configuration
    let (api_key, evm_canister, alchemy_key, custom_url) = STATE.with(|state| {
        let config = &state.borrow().resolver_config;
        (
            config.oneinch_api_key.clone(), 
            config.evm_rpc_canister,
            config.alchemy_api_key.clone(),
            config.custom_rpc_url.clone(),
        )
    });
    
    // Fetch current orders from 1inch via HTTP API
    let orders = HttpClient::fetch_fusion_orders(api_key.as_deref(), 1).await?;
    
    // Convert 1inch orders to our format and evaluate profitability
    for oneinch_order in orders {
        let order = convert_oneinch_order(oneinch_order)?;
        
        // Evaluate profitability
        let profitability = calculate_profitability(&order).await?;
        
        if profitability.estimated_profit > get_min_profit_threshold() {
            // Create EVM client with appropriate provider
            let evm_client = if let Some(alchemy_key) = alchemy_key {
                EvmRpcClient::new_with_alchemy(evm_canister, alchemy_key)
            } else if let Some(custom_url) = custom_url {
                EvmRpcClient::new_with_custom_provider(evm_canister, custom_url)
            } else {
                EvmRpcClient::new(evm_canister) // Default: consensus providers
            };
            
            let bid_success = submit_bid_via_evm(&evm_client, &order).await?;
            
            results.push(BidResult {
                order_hash: order.order_hash.clone(),
                bid_accepted: bid_success,
                profitability_score: profitability.score,
                estimated_profit: profitability.estimated_profit,
            });
        }
    }
    
    Ok(results)
}

#[ic_cdk::update]
pub async fn create_atomic_escrows(order: CrossChainOrder) -> ResolverResult<EscrowPair> {
    // Validate order
    ResolverUtils::validate_order_hash(&order.order_hash)?;
    ResolverUtils::validate_token_address(&order.maker_asset)?;
    ResolverUtils::validate_token_address(&order.taker_asset)?;
    
    // Derive ICP recipient from Ethereum maker address
    let icp_recipient = ResolverUtils::derive_icp_principal(&order.maker)?;
    
    // Create HTLC on ICP side
    let icp_escrow_id = create_icp_htlc(
        order.taking_amount,
        icp_recipient,
        order.hash_lock,
        order.time_lock,
    )?;
    
    // Create HTLC on Ethereum side via EVM RPC
    let evm_canister = STATE.with(|state| state.borrow().resolver_config.evm_rpc_canister);
    let evm_client = EvmRpcClient::new(evm_canister);
    let eth_escrow_address = evm_client.create_ethereum_htlc(&order).await?;
    
    let escrow_pair = EscrowPair {
        ethereum_escrow: eth_escrow_address,
        icp_escrow: icp_escrow_id,
    };
    
    // Store order and escrow info
    STATE.with(|state| {
        state.borrow_mut().active_orders.insert(order.order_hash.clone(), order);
    });
    
    Ok(escrow_pair)
}

#[ic_cdk::update]
pub async fn complete_atomic_swap(order_hash: String, secret: [u8; 32]) -> ResolverResult<()> {
    // Verify secret matches hash_lock
    let hash_array = ResolverUtils::generate_secret_hash(&secret);
    
    STATE.with(|state| {
        let mut state_mut = state.borrow_mut();
        
        if let Some(order) = state_mut.active_orders.get(&order_hash) {
            if hash_array != order.hash_lock {
                return Err(ResolverError::InvalidInput("Invalid secret for order".to_string()));
            }
            
            // Mark swap as completed
            state_mut.completed_swaps.insert(order_hash.clone(), ic_cdk::api::time());
            state_mut.active_orders.remove(&order_hash);
            
            Ok(())
        } else {
            Err(ResolverError::InvalidInput("Order not found".to_string()))
        }
    })
}

#[ic_cdk::update]
pub async fn fetch_orders_from_oneinch(chain_id: u64) -> ResolverResult<Vec<OneInchOrder>> {
    let api_key = STATE.with(|state| state.borrow().resolver_config.oneinch_api_key.clone());
    HttpClient::fetch_fusion_orders(api_key.as_deref(), chain_id).await
}

#[ic_cdk::update]
pub async fn get_price_quote(
    from_token: String,
    to_token: String,
    amount: String,
    chain_id: u64,
) -> ResolverResult<OneInchQuoteResponse> {
    let api_key = STATE.with(|state| state.borrow().resolver_config.oneinch_api_key.clone());
    HttpClient::get_quote(&from_token, &to_token, &amount, api_key.as_deref(), chain_id).await
}

#[ic_cdk::update]
pub async fn verify_ethereum_settlement(tx_hash: String) -> ResolverResult<bool> {
    let evm_canister = STATE.with(|state| state.borrow().resolver_config.evm_rpc_canister);
    let evm_client = EvmRpcClient::new(evm_canister);
    evm_client.verify_transaction_settlement(&tx_hash).await
}

#[ic_cdk::update]
pub async fn update_resolver_config(config: ResolverConfig) -> ResolverResult<()> {
    // Validate config
    for token in &config.supported_tokens {
        ResolverUtils::validate_token_address(token)?;
    }
    
    STATE.with(|state| {
        state.borrow_mut().resolver_config = config;
    });
    
    Ok(())
}

#[ic_cdk::query]
pub fn get_resolver_config() -> ResolverConfig {
    STATE.with(|state| state.borrow().resolver_config.clone())
}

#[ic_cdk::query]
pub fn get_active_orders() -> Vec<CrossChainOrder> {
    STATE.with(|state| {
        state.borrow().active_orders.values().cloned().collect()
    })
}

#[ic_cdk::query]
pub fn get_completed_swaps() -> Vec<(String, u64)> {
    STATE.with(|state| {
        state.borrow().completed_swaps.iter().map(|(k, v)| (k.clone(), *v)).collect()
    })
}

// Helper functions
fn convert_oneinch_order(oneinch_order: OneInchOrder) -> ResolverResult<CrossChainOrder> {
    let secret = ResolverUtils::generate_htlc_secret();
    let hash_lock = ResolverUtils::generate_secret_hash(&secret);
    
    Ok(CrossChainOrder {
        maker: oneinch_order.maker,
        maker_asset: oneinch_order.maker_asset,
        making_amount: oneinch_order.making_amount.parse()
            .map_err(|_| ResolverError::ProcessingError("Invalid making amount".to_string()))?,
        taker_asset: oneinch_order.taker_asset,
        taking_amount: oneinch_order.taking_amount.parse()
            .map_err(|_| ResolverError::ProcessingError("Invalid taking amount".to_string()))?,
        src_chain_id: 1, // Ethereum
        dst_chain_id: 0, // ICP (placeholder)
        hash_lock,
        time_lock: oneinch_order.creation_timestamp + oneinch_order.auction_duration,
        order_hash: oneinch_order.hash,
        auction_details: AuctionDetails {
            duration: oneinch_order.auction_duration,
            start_time: oneinch_order.auction_start_date,
            initial_rate_bump: oneinch_order.initial_rate_bump,
            gas_price: 0, // Will be fetched separately
        },
    })
}

async fn calculate_profitability(order: &CrossChainOrder) -> ResolverResult<ProfitabilityAnalysis> {
    // Get current gas price
    let evm_canister = STATE.with(|state| state.borrow().resolver_config.evm_rpc_canister);
    let evm_client = EvmRpcClient::new(evm_canister);
    let gas_price = evm_client.get_gas_price().await?;
    
    // Estimate gas costs (simplified)
    let estimated_gas = 200_000u128; // Gas for HTLC creation + settlement
    let gas_cost = gas_price * estimated_gas;
    
    // Calculate profitability
    let score = ResolverUtils::calculate_profitability_score(
        order.making_amount,
        order.taking_amount,
        gas_cost,
        2000.0, // ETH price placeholder
    );
    
    let gross_profit = order.taking_amount.saturating_sub(order.making_amount);
    let net_profit = gross_profit.saturating_sub(gas_cost);
    
    Ok(ProfitabilityAnalysis {
        score,
        estimated_profit: net_profit,
        gas_costs: gas_cost,
        price_impact: 0.1, // Placeholder
        competition_level: 3, // Placeholder
    })
}

async fn submit_bid_via_evm(evm_client: &EvmRpcClient, order: &CrossChainOrder) -> ResolverResult<bool> {
    // TODO: Implement actual bidding via smart contract interaction
    // This would involve:
    // 1. Preparing transaction data for 1inch Settlement contract
    // 2. Signing transaction with threshold ECDSA
    // 3. Submitting transaction via EVM RPC
    
    ic_cdk::println!("Would submit bid for order {}", order.order_hash);
    Ok(false) // Placeholder
}

fn create_icp_htlc(
    amount: u128,
    recipient: Principal,
    hash_lock: [u8; 32],
    time_lock: u64,
) -> ResolverResult<String> {
    // TODO: Implement actual ICP HTLC creation
    // This would involve:
    // 1. Transferring ICP tokens to escrow
    // 2. Setting up hash/time locks
    // 3. Storing escrow details
    
    let contract_id = format!("htlc_{}_{}", ic_cdk::api::time(), hash_lock[0]);
    
    // Store escrow info
    STATE.with(|state| {
        let escrow = HTLCEscrow {
            contract_id: contract_id.clone(),
            hash_lock,
            time_lock,
            amount,
            sender: ic_cdk::caller(),
            recipient,
            status: EscrowStatus::Locked,
            secret: None,
        };
        state.borrow_mut().active_escrows.insert(contract_id.clone(), escrow);
    });
    
    Ok(contract_id)
}

fn get_min_profit_threshold() -> u128 {
    STATE.with(|state| state.borrow().resolver_config.min_profit_threshold)
}

// Export candid interface
ic_cdk::export_candid!();