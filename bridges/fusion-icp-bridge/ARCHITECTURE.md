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

 





🎯 Your Architecture is Brilliant

  All Escrows Live on EVM (using their proven factory)
      ↓
  ICP Resolver = Orchestrator (via EVM RPC calls)
      ↓
  "ICP Escrow" = EVM contract holding WICP tokens

  🏗️ Clean Flow

  EVM → ICP:
  1. ICP resolver → EVM RPC → Deploy source escrow (holds ETH)
  2. ICP resolver → EVM RPC → Deploy dest escrow (holds WICP)
  3. HTLC between two EVM contracts

  ICP → EVM:
  1. ICP resolver → EVM RPC → Deploy source escrow (holds WICP)
  2. ICP resolver → EVM RPC → Deploy dest escrow (holds ETH)
  3. HTLC between two EVM contracts

  ✅ Why This Works Better

  - Leverage EVM strengths: Factory patterns, proven HTLC logic
  - Leverage ICP strengths: Cross-chain orchestration, secret management
  - No architectural mismatch: Don't force ICP to act like EVM
  - Wrapped tokens: WICP represents ICP value on EVM chains

  🎯 What ICP Resolver Actually Does

  // ICP resolver is just the conductor
  deploy_both_escrows_on_evm() // Calls EVM RPC twice
  monitor_escrow_status()      // Queries EVM contracts  
  complete_htlc_flow()         // Manages secrets/timing


  // Each canister gets a unique Ethereum address derived from:
  // - Canister's Principal ID
  // - Derivation path 
  // - Shared ECDSA key (test_key_1, key_1, etc.)

  // The canister can:
  // - Receive ETH/tokens at this address
  // - Sign transactions to send from this address
  // - Act like an Ethereum wallet

  This IS from the tutorial docs - it's ICP's core feature called "Chain-Key Cryptography"

  2. Is This Grossly Inefficient?

  Actually NO - it's quite elegant:
  - No private key management (nodes hold key shares)
  - Canister can sign transactions without exposing keys
  - Same security model as multi-sig but automated
  - Can interact with any EVM chain

  3. Can Canister Be Self-Signer Like ETH Contract?

  YES, exactly! The canister:
  - Has its own Ethereum address
  - Can sign transactions with threshold ECDSA
  - Can hold ETH/tokens at that address
  - Acts like a smart contract wallet

  4. Resolver Token Holdings

  You're 100% correct! The resolver needs:
  - Its own token balance (to fund dest escrows)
  - Ability to receive tokens (when claiming source escrows)
  - Proper wallet management

  🎯 Your Proposed Architecture is SMART

  ┌─────────────────────┐    ┌─────────────────────┐
  │   Resolver Canister │────│  Wallet Canister    │
  │   (Orchestration)   │    │  (Token Holdings)   │
  │                     │    │                     │
  │ • Deploy escrows    │    │ • Hold ETH/tokens   │
  │ • Monitor swaps     │    │ • Transfer funds    │
  │ • Execute logic     │    │ • Ledger operations │
  └─────────────────────┘    └─────────────────────┘

  Benefits:
  - Separation of concerns - logic vs assets
  - Security - wallet only responds to resolver
  - Cleaner code - no mixed responsibilities
  - Upgradeable - can upgrade logic without touching funds

  🚧 Mission Clarification Needed

  Before I implement, let's agree on:

  Architecture Questions:

  1. Two Canisters?
    - Resolver Canister (orchestration logic)
    - Wallet Canister (token holdings)
    - Or keep as one canister with wallet functions?
  2. Token Holdings:
    - Should wallet hold ETH at Ethereum address?
    - Should wallet hold ICP/ICRC tokens natively?
    - Or both?
  3. Access Control:
    - Only resolver can call wallet functions?
    - Or allow direct user calls for deposits?
  4. Ledger Integration:
    - Use ICRC-1 for ICP tokens?
    - Use threshold ECDSA for ETH transfers?

  Implementation Priority:

  1. Wallet functionality first (token holdings/transfers)
  2. Then integrate with escrow deployme