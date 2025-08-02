# ICP-Ethereum Bridge Implementation Roadmap

## Answers to Key Questions

### Q: "What is the resolver even for?"
**A: The resolver is the entity that FULFILLS the cross-chain swap**

- **User creates order** (what our test does) ✅
- **Resolver competes** in Dutch auction to win the order
- **Resolver provides liquidity** by depositing tokens on both chains
- **Resolver earns profit** from price difference in auction
- **Resolver manages** the atomic swap execution

### Q: "How does the protocol handle fulfillment?"
**A: Through HTLC (Hash Time-Locked Contracts) on both chains**

1. **Escrow Creation**: Resolver locks tokens on both chains with same hashlock
2. **Secret Revelation**: User reveals secret to unlock destination tokens  
3. **Atomic Unlock**: Resolver uses same secret to unlock source tokens
4. **Profit**: Resolver keeps the price difference as profit

### Q: "Do we create a 1inch canister that listens to orders?"
**A: Yes! We create an ICP Resolver Canister that:**

- **Monitors** Ethereum for 1inch orders via EVM RPC canister
- **Participates** in Dutch auctions as a resolver
- **Creates** HTLC escrows on both ICP and Ethereum
- **Manages** the cross-chain atomic swap flow

## Implementation Plan

### Phase 1: Core HTLC Infrastructure (Week 1-2)

#### 1.1 ICP HTLC Canister
```rust
// Priority: HIGH - Foundation for everything
pub struct HTLCContract {
    sender: Principal,
    receiver: Principal,
    amount: Nat,
    hashlock: String,
    timelock: u64,
    withdrawn: bool,
    refunded: bool,
}

impl HTLCContract {
    pub fn new(sender: Principal, receiver: Principal, amount: Nat, hashlock: String, timelock: u64) -> Self
    pub fn withdraw(&mut self, secret: String) -> Result<(), String>
    pub fn refund(&mut self) -> Result<(), String>
}
```

#### 1.2 Ethereum Integration via EVM RPC
```rust
// Connect to Ethereum using ICP's EVM RPC canister
pub async fn create_ethereum_htlc(
    to: String,
    amount: String, 
    hashlock: String,
    timelock: u64
) -> Result<String, String>

pub async fn monitor_ethereum_htlc(contract_address: String) -> HTLCStatus
```

#### 1.3 Basic Test
Create a simple HTLC test between ICP and Ethereum:
- Lock tokens on both chains
- Reveal secret
- Unlock atomically

### Phase 2: 1inch Order Monitoring (Week 3)

#### 2.1 Order Detection
```rust
// Monitor 1inch orders on Ethereum
pub async fn scan_fusion_orders() -> Vec<FusionOrder> {
    // Use EVM RPC to query 1inch events
    let events = get_ethereum_logs(FUSION_CONTRACT, last_block).await;
    parse_fusion_orders(events)
}

// Parse 1inch order format
pub fn parse_fusion_order(log: EthereumLog) -> Option<FusionOrder>
```

#### 2.2 Order Evaluation  
```rust
// Evaluate if order is profitable
pub fn evaluate_order_profitability(order: &FusionOrder) -> bool {
    let our_cost = calculate_swap_cost(&order);
    let potential_profit = order.making_amount - our_cost;
    potential_profit > MIN_PROFIT_THRESHOLD
}
```

### Phase 3: Dutch Auction Participation (Week 4)

#### 3.1 Bidding Logic
```rust
// Participate in Dutch auction
pub async fn bid_on_order(order: &FusionOrder, our_price: Nat) -> Result<(), String> {
    // Create Ethereum transaction to win the auction
    let tx_data = encode_resolver_bid(order, our_price);
    submit_eth_transaction(tx_data).await
}

// Monitor auction status
pub async fn check_auction_result(order_hash: String) -> AuctionResult
```

#### 3.2 Escrow Creation Automation
```rust
// If we win the auction, create escrows
pub async fn handle_auction_win(order: FusionOrder) -> Result<(), String> {
    // 1. Create HTLC on Ethereum (source)
    let eth_htlc = create_ethereum_htlc(
        order.maker_asset,
        order.making_amount,
        order.hashlock,
        order.timelock
    ).await?;
    
    // 2. Create HTLC on ICP (destination)  
    let icp_htlc = create_icp_htlc(
        order.taker_asset,
        order.taking_amount,
        order.hashlock,
        order.timelock
    ).await?;
    
    Ok(())
}
```

### Phase 4: User Interface (Week 5)

#### 4.1 Order Creation Interface
- Web interface for users to create cross-chain orders
- Integration with existing 1inch order creation
- Status monitoring for orders

#### 4.2 Secret Management
- Secure secret generation and storage
- Automatic secret revelation after escrow verification
- Recovery mechanisms for failed swaps

## Technical Implementation Details

### ICP Canister Architecture
```rust
// Main resolver canister
#[ic_cdk::init]
fn init() {
    // Initialize EVM RPC connection
    // Set up timer for order monitoring
}

#[ic_cdk::update]
async fn monitor_orders() -> Vec<FusionOrder> {
    scan_fusion_orders().await
}

#[ic_cdk::update]  
async fn participate_in_auction(order_hash: String, bid: Nat) -> Result<(), String> {
    bid_on_order(order_hash, bid).await
}

#[ic_cdk::update]
async fn create_cross_chain_swap(order: FusionOrder) -> Result<SwapPair, String> {
    handle_auction_win(order).await
}
```

### EVM RPC Integration
```rust
// Use ICP's EVM RPC canister for all Ethereum interactions
use ic_evm_rpc::*;

async fn call_ethereum_contract(
    contract: String,
    method: String, 
    params: Vec<String>
) -> Result<String, String> {
    let rpc_config = RpcConfig {
        response_consensus: Some(ResponseConsensus::default()),
    };
    
    let result = call(
        RpcService::EthMainnet(Some(vec![EthMainnetService::Alchemy])),
        json_rpc_request,
        max_response_bytes,
        rpc_config,
    ).await;
    
    handle_rpc_response(result)
}
```

## Success Metrics

### Phase 1 Success
- [ ] Can create HTLC on both ICP and Ethereum
- [ ] Can unlock with secret atomically
- [ ] Refund mechanism works after timelock

### Phase 2 Success  
- [ ] Detects real 1inch orders from mainnet
- [ ] Parses order data correctly
- [ ] Evaluates profitability accurately

### Phase 3 Success
- [ ] Successfully wins Dutch auctions
- [ ] Creates escrows automatically after winning
- [ ] Completes full atomic swap flow

### Phase 4 Success
- [ ] Users can create orders via UI
- [ ] Orders execute successfully end-to-end
- [ ] Resolver earns profit from spreads

## Next Immediate Steps

1. **Create ICP HTLC canister** with lock/unlock/refund functions
2. **Test EVM RPC integration** for Ethereum contract calls  
3. **Implement order monitoring** for 1inch Fusion+ events
4. **Build auction participation** logic
5. **Connect everything** for end-to-end atomic swaps

This architecture makes ICP a fully functional participant in the 1inch ecosystem while leveraging ICP's unique capabilities for cost-effective, fast cross-chain operations.