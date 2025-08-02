# ICP-Ethereum 1inch Cross-Chain Bridge Architecture

## Overview
This architecture enables atomic swaps between Ethereum and Internet Computer Protocol (ICP) using 1inch Fusion+ standards.

## Component Architecture

### 1. ICP Resolver Canister (Core Component)
**Purpose**: Acts as the "resolver" in 1inch terminology - monitors orders and facilitates swaps

**Capabilities**:
- Monitors 1inch orders via EVM RPC canister
- Competes in Dutch auctions
- Creates HTLC escrows on both chains
- Manages cross-chain secret sharing

**Key Functions**:
```rust
// Monitor 1inch orders on Ethereum
pub async fn monitor_fusion_orders() -> Vec<FusionOrder>

// Compete in Dutch auction
pub async fn bid_on_order(order_hash: String, bid_price: Nat) -> Result<(), String>

// Create escrows on both chains
pub async fn create_cross_chain_escrows(order: FusionOrder) -> Result<EscrowPair, String>

// Handle secret revelation
pub async fn reveal_secret(secret: String, order_hash: String) -> Result<(), String>
```

### 2. ICP HTLC Canister (Escrow Management)
**Purpose**: Implements Hash Time-Locked Contracts on ICP side

**Capabilities**:
- Lock ICP tokens with hashlock/timelock
- Verify Ethereum escrow creation
- Handle atomic unlocking with secret
- Refund mechanism for failed swaps

**Key Functions**:
```rust
// Create HTLC escrow on ICP
pub fn create_htlc(
    sender: Principal,
    receiver: Principal, 
    amount: Nat,
    hashlock: String,
    timelock: u64
) -> Result<String, String>

// Unlock with secret
pub fn unlock_htlc(contract_id: String, secret: String) -> Result<(), String>

// Refund after timelock
pub fn refund_htlc(contract_id: String) -> Result<(), String>
```

### 3. EVM Integration Layer
**Purpose**: Communicates with Ethereum using ICP's EVM RPC canister

**Capabilities**:
- Sign and submit Ethereum transactions
- Monitor Ethereum escrow contracts
- Query 1inch order status
- Handle threshold ECDSA signatures

**Key Functions**:
```rust
// Submit Ethereum transaction
pub async fn submit_eth_transaction(tx_data: String) -> Result<String, String>

// Monitor Ethereum events
pub async fn get_ethereum_logs(contract: String, from_block: u64) -> Vec<Log>

// Query 1inch order
pub async fn get_fusion_order(order_hash: String) -> Option<FusionOrder>
```

## Data Flow

### Ethereum → ICP Swap
1. **User creates 1inch order** on Ethereum (using our existing code)
2. **ICP Resolver monitors** Ethereum for new orders
3. **Resolver bids** in Dutch auction via EVM RPC
4. **If winning**: Resolver creates escrows on both chains
5. **User verifies** ICP escrow and reveals secret
6. **Atomic unlock** happens on both chains

### ICP → Ethereum Swap  
1. **User creates order** via ICP Resolver canister
2. **Resolver creates** 1inch-compatible order on Ethereum
3. **Standard 1inch flow** with ICP handling destination side

## Security Features

### Atomic Guarantees
- Both escrows must exist before secret revelation
- Same hashlock links both chains
- Timelock prevents indefinite locking
- Refund mechanism for failed swaps

### Trustless Operation
- No centralized relayer needed
- Smart contracts enforce all rules
- Threshold ECDSA for secure signing
- Decentralized RPC prevents single point of failure

## Implementation Phases

### Phase 1: Basic HTLC (Current Priority)
- [ ] ICP HTLC canister with lock/unlock/refund
- [ ] Ethereum interaction via EVM RPC
- [ ] Basic secret management

### Phase 2: 1inch Integration
- [ ] Order monitoring and parsing
- [ ] Dutch auction participation
- [ ] Escrow creation automation

### Phase 3: User Interface
- [ ] Frontend for order creation
- [ ] Status monitoring dashboard
- [ ] Secret revelation interface

### Phase 4: Advanced Features
- [ ] Multi-resolver support
- [ ] Fee optimization
- [ ] Cross-chain token registry

## Technical Requirements

### ICP Canisters
- Rust-based for performance
- Cycles for computation costs
- Inter-canister calls for modularity
- Stable memory for persistence

### Ethereum Integration
- EVM RPC canister for all Ethereum interactions
- Threshold ECDSA for transaction signing
- HTTPS outcalls for 1inch API (if needed)
- Event monitoring for order detection

### Standards Compliance
- 1inch Fusion+ order format
- EIP-712 signatures for Ethereum
- HTLC atomic swap patterns
- Chain-key token integration (ckETH/ckERC20)

## Advantages Over Traditional Bridges

1. **No Wrapped Tokens**: Direct asset swaps
2. **Atomic Guarantees**: All-or-nothing execution
3. **Decentralized**: No central authority
4. **Cost Effective**: ICP's low computation costs
5. **Fast Finality**: 1-2 second transactions on ICP
6. **1inch Liquidity**: Access to best prices across all DEXs





  🎯 Correct Architecture: On-Chain Resolver + User-Triggered Fetching

  Why This is Better:

  1. Tamper-proof: All resolver logic on ICP canister
  2. No continuous costs: Only runs when triggered
  3. Follows 1inch standards: Resolver as smart contract
  4. User-controlled: Frontend triggers when needed

  📋 Simplified Flow:

  1. ICP Resolver Canister

  // Resolver logic on-chain, triggered by users
  #[ic_cdk::update]
  pub async fn check_and_bid_on_orders() -> Vec<OrderResult> {
      // Fetch latest orders via EVM RPC (when called)
      let orders = fetch_fusion_orders_from_ethereum().await;

      // Evaluate profitability (on-chain logic)
      let profitable = orders.iter()
          .filter(|order| is_profitable(order))
          .collect();

      // Bid on profitable orders
      for order in profitable {
          bid_on_order(order).await;
      }
  }

  #[ic_cdk::update]
  pub async fn create_htlc_for_won_order(order: FusionOrder) -> Result<String, String> {
      // Create HTLC escrow after winning auction
  }

  2. Frontend Triggers

  // User clicks "Check for Orders" in UI
  const results = await actor.check_and_bid_on_orders();

  // User clicks "Execute Swap"  
  const htlc = await actor.create_htlc_for_won_order(order);

  3. Benefits:

  ✅ Tamper-proof: Logic can't be manipulated✅ Cost-efficient: Only runs when triggered✅ Standard-compliant: Follows 1inch resolver pattern✅
  User-controlled: No background processes

  🚀 Next Steps:

  1. Build ICP Resolver Canister with EVM RPC integration
  2. Add order fetching and evaluation logic
  3. Create simple frontend trigger buttons
  4. Test with real 1inch orders