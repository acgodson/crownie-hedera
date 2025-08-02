# ICP-Ethereum 1inch Cross-Chain Bridge Architecture

## Overview
This architecture enables atomic swaps between Ethereum and Internet Computer Protocol (ICP) using 1inch Fusion+ standards.

## Component Architecture

### 1. ICP Resolver Canister (Core Component)
**Purpose**: Acts as professional "resolver" in 1inch Fusion+ cross-chain ecosystem

**Enhanced Capabilities**:
- **EVM Identity Derivation**: Converts Ethereum addresses to ICP Principals
- **1inch Fusion+ Integration**: Monitors real cross-chain orders via EVM RPC
- **Dutch Auction Competition**: Competes with other resolvers for profitable swaps
- **Atomic Escrow Management**: Creates HTLCs on both Ethereum and ICP
- **Automated Secret Sharing**: Handles cryptographic secret revelation

**Updated Key Functions**:
```rust
// Derive ICP Principal from Ethereum address (SIWE-S)
pub fn derive_icp_principal(eth_address: String) -> Principal

// Monitor real 1inch Fusion+ cross-chain orders
pub async fn monitor_fusion_plus_orders() -> Vec<CrossChainOrder>

// Compete in Dutch auction with profitability analysis
pub async fn evaluate_and_bid_orders() -> Vec<BidResult>

// Create atomic escrows on both chains
pub async fn create_atomic_escrows(order: CrossChainOrder) -> Result<EscrowPair, String>

// Handle automatic secret revelation and settlement
pub async fn complete_atomic_swap(order_hash: String, secret: [u8; 32]) -> Result<(), String>
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

## Updated Data Flow (2025)

### **Ethereum → ICP Swap (Matches 1inch Fusion+ Standard)**
1. **User connects Ethereum wallet** (0x123...abc) - no ICP address needed
2. **System derives ICP Principal** deterministically from Ethereum address
3. **User signs 1inch Fusion+ order** specifying ETH → ICP swap
4. **ICP Resolver monitors** Ethereum for new cross-chain orders
5. **Resolver competes** in Dutch auction via EVM RPC
6. **If winning**: Resolver creates atomic escrows:
   - **Ethereum HTLC**: Locks user's ETH with secret hash
   - **ICP HTLC**: Locks resolver's ICP with same secret hash
7. **Automatic completion**: Secret revealed → both escrows unlock atomically
8. **User receives ICP** tokens at derived Principal (accessible via Ethereum wallet)

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