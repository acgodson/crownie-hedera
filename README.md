# Crownie - Fusion+ EVM to ICP Cross-Chain Bridge

A decentralized atomic swap bridge enabling seamless token transfers between Ethereum Virtual Machine (EVM) chains and the Internet Computer Protocol (ICP) using 1inch Fusion+ standards and Hash Time-Locked Contracts (HTLCs).

## 🎯 Overview

Crownie bridges the gap between EVM chains and ICP by implementing a trustless, atomic swap mechanism. Users can swap ETH for WICP (or other tokens) across chains without relying on centralized exchanges or custodial bridges.

**Key Features:**
- ⚡ **Atomic Swaps**: All-or-nothing guarantees using HTLCs
- 🔒 **Trustless**: No custodial risk or centralized control  
- 🌉 **Cross-Chain**: Support for Ethereum, Polygon, BSC ↔ ICP
- 🎮 **1inch Fusion+ Compatible**: Leverages proven DEX infrastructure
- 🤝 **Social Coordination**: Novel relayer mechanism via video meeting consensus

## 🏗️ Architecture

### Core Components

1. **EVM Resolver Contract**: Deploys and manages escrows on EVM chains
2. **ICP Resolver Canister**: Orchestrates cross-chain swaps and manages ICP escrows  
3. **Wallet Canister**: Holds resolver's token inventory for funding escrows
4. **Relayer System**: Crownie's unique social consensus mechanism
5. **HTLC Escrows**: Lock funds with cryptographic guarantees on both chains

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   EVM Chain         │    │   ICP Network       │    │   Crownie Relay     │
│  ┌───────────────┐  │    │  ┌───────────────┐  │    │  ┌───────────────┐  │
│  │ 1inch Fusion+ │  │    │  │   Resolver    │  │    │  │ Video Meeting │  │
│  │   Resolver    │  │◄───┼──┤   Canister    │  │◄───┼──┤   Consensus   │  │
│  └───────────────┘  │    │  └───────────────┘  │    │  └───────────────┘  │
│  ┌───────────────┐  │    │  ┌───────────────┐  │    │  ┌───────────────┐  │
│  │ ETH Escrow    │  │    │  │ WICP Escrow   │  │    │  │ Secret Shares │  │
│  │ Contract      │  │    │  │ Canister      │  │    │  │ Management    │  │
│  └───────────────┘  │    │  └───────────────┘  │    │  └───────────────┘  │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## 🔄 Cross-Chain Swap Flow

Let's walk through Bob's journey swapping **1 ETH → 2000 WICP**:

### 1. **Bob Initiates Swap**

Bob wants to swap ETH for WICP on ICP.

**What happens:**
- Bob creates an order on 1inch Fusion+ 
- EVM resolver deploys an **ETH escrow contract** 
- Bob locks **1 ETH** in the escrow with:
  - `secret_hash` = `keccak256(random_secret)`
  - `timelock` = 2 hours expiry
  - `recipient` = resolver address

```solidity
// EVM Escrow State
locked_amount: 1 ETH
secret_hash: 0xabc123...
timelock: block.timestamp + 7200
recipient: resolver_address
```

---

### 2. **ICP Resolver Deploys Destination Escrow**

The **ICP Resolver Canister** detects the EVM escrow creation (triggered by external relay).

**What it does:**
- Creates a matching **WICP escrow canister** on ICP
- Funds it with **2000 WICP** from its wallet canister
- Uses **same cryptographic parameters**:
  - `secret_hash` = same as EVM escrow  
  - `timelock` = same expiry
  - `recipient` = Bob's ICP principal (derived from his ETH address)

```rust
// ICP Escrow State  
locked_amount: 2000 WICP
secret_hash: 0xabc123... // Same as EVM!
timelock: ic_time + 7200
recipient: Bob's_ICP_Principal
```

✅ **Both escrows are now locked** — atomic swap is ready!

---

### 3. **Crownie Relayer Verifies Both Escrows**

Here's where Crownie's **social consensus** shines:

**The Crownie Live Extension:**
- Participants join a video meeting about this swap
- Extension monitors **both chains simultaneously**
- Verifies:
  - ✅ ETH is locked on Ethereum
  - ✅ WICP is locked on ICP  
  - ✅ Same secret_hash on both chains
  - ✅ Reasonable timelock (prevents rushed decisions)

**Consensus Mechanism:**
- Meeting participants hold **threshold secret shares**
- Once verification complete, they collectively vote: **"Safe to proceed"**
- Extension tells Bob: *"Both escrows verified. You can safely reveal your secret."*

---

### 4. **Bob Reveals Secret on ICP**

Bob trusts the social verification and reveals his secret on the **ICP escrow**.

**Transaction:**
```rust
// Bob calls ICP escrow canister
escrow_canister.claim(secret: [u8; 32])

// Canister validates:
if keccak256(secret) == stored_secret_hash {
    // Transfer 2000 WICP to Bob's ICP wallet
    transfer_wicp(recipient: Bob's_ICP_Principal, amount: 2000)
    
    // Emit secret in transaction logs for relayer
    ic_cdk::print!("Secret revealed: {}", hex::encode(secret));
}
```

🎉 **Bob now has 2000 WICP on ICP!**

---

### 5. **Relayer Unlocks ETH for Resolver**

The Crownie relayer (or any observer) sees the secret from ICP transaction logs.

**What happens:**
- Relayer extracts `secret` from ICP transaction
- Calls EVM escrow: `claim(secret)`  
- EVM escrow validates `keccak256(secret) == secret_hash`
- **1 ETH** transfers to resolver's wallet

```solidity
// EVM escrow validates and releases
function claim(bytes32 secret) external {
    require(keccak256(secret) == secret_hash, "Invalid secret");
    require(block.timestamp < timelock, "Expired");
    
    payable(resolver).transfer(locked_amount); // 1 ETH to resolver
}
```

✅ **Atomic swap complete!** Both parties got their tokens.

---

### 6. **Optional: Bob Bridges WICP to EVM**

If Bob wants his WICP back on Ethereum as an ERC-20:

**Bridge Process:**
- Bob burns **2000 WICP** on ICP via Helix/ckETH bridge
- ICP bridge relayer mints **2000 WICP** ERC-20 tokens on Ethereum
- Bob receives ERC-20 WICP in his original ETH wallet

**Bob's Final Options:**
1. **Keep WICP on ICP** - Use in ICP DeFi ecosystem
2. **Bridge to EVM** - Get ERC-20 WICP on Ethereum
3. **Use CEX** - Trade WICP for other tokens

---

## 🛡️ Security Guarantees

### Atomic Swap Properties

**✅ Atomicity**: Either both parties get their tokens OR neither does  
**✅ Consistency**: Same secret unlocks both escrows  
**✅ Isolation**: Escrows are independent until secret reveal  
**✅ Durability**: Blockchain guarantees permanent settlement  

### Attack Prevention

| Attack Vector | Protection |
|---------------|------------|
| **Front-running** | Secret is only revealed after both escrows funded |
| **Griefing** | Timelock allows refunds if counterparty disappears |
| **Double-spend** | Blockchain consensus prevents double-spending |
| **Rug pull** | No custodial control - funds locked in smart contracts |
| **Relayer failure** | Anyone can observe secret and complete swap |

---

## 🚀 Getting Started

### Prerequisites

- **dfx** (Internet Computer SDK)
- **Rust** (for canister development)  
- **Node.js** (for frontend/testing)
- **1inch API Key** (for production)

### Quick Start

1. **Clone & Setup**
```bash
git clone <repository>
cd crownie-fusion-bridge
npm install
```

2. **Start Local ICP Replica**
```bash
dfx start --background --clean
```

3. **Deploy Canisters**
```bash
dfx deploy
```

4. **Run Tests**
```bash
# Rust unit tests
cargo test --manifest-path src/resolver_canister_backend/Cargo.toml

# Integration tests  
npm test
```

5. **Test Manually**
```bash
# Configure for Sepolia testnet
dfx canister call resolver_canister_backend configure_for_sepolia_testnet

# Get resolver's ETH address
dfx canister call resolver_canister_backend get_resolver_eth_address

# Check active swaps
dfx canister call resolver_canister_backend get_active_swaps
```

---

## 🧪 Testing

### Test Coverage

**✅ 12 Rust Unit Tests**
- Configuration management
- Swap state tracking  
- HTLC logic validation
- Error handling
- ECDSA key derivation

**✅ Integration Tests**  
- Cross-chain swap simulation
- Escrow funding verification
- Secret revelation flow
- Timeout/refund scenarios

**✅ Manual Testing**
```bash
# Test configuration
dfx canister call resolver_canister_backend get_config

# Test ETH address derivation  
dfx canister call resolver_canister_backend get_resolver_eth_address

# Test swap initiation (requires valid principals)
dfx canister call resolver_canister_backend initiate_evm_to_icp_swap \
  '("0x742d35cc6435c7a0c9bb8cb2de6bb7eac81b9e8c", "be2us-64aaa-aaaaa-qaabq-cai", "0x0000000000000000000000000000000000000000", "be2us-64aaa-aaaaa-qaabq-cai", 1000000000000000000:nat, 3600:nat64)'
```

### How to Test Your Fusion-ICP Bridge on Sepolia

**1. Get Required API Keys & Setup**

```bash
# 1. Get 1inch Developer Portal API Key
# Visit: https://portal.1inch.dev/
# Sign up and create an API key

# 2. Get Sepolia Testnet ETH
# Visit: https://faucets.chain.link/sepolia
# Get testnet ETH for gas fees

# 3. Setup environment
cp .env.example .env
# Fill in your actual values
```

**2. Install Dependencies & Run Tests**

```bash
# Install all workspace dependencies
pnpm install

# Run the bridge tests
cd bridges/fusion-icp-bridge
npm run test:fusion
```

**3. What the Tests Do**

✅ **FusionService Test:**
- Tests quote generation on Sepolia testnet
- Uses real Sepolia token addresses (USDC → ETH)
- Validates pricing and gas estimation

✅ **Cross-Chain Order Test:**
- Creates HTLC with hashlock/secret
- Tests cross-chain order structure
- Validates deadline and order ID generation

✅ **ICP Service Test:**
- Initializes ICP canister connection
- Tests authentication flow
- Validates service readiness

**4. Expected Output**

```
🚀 Starting Fusion-ICP Bridge Tests

🔄 Testing Fusion Quote...
✅ Quote successful: {
  sellAmount: "1000000",
  buyAmount: "0.0003456789",
  price: "2890.45"
}

🔄 Testing Cross-Chain Order Creation...
✅ Cross-chain order created: {
  orderId: "order_1704123456_abc123def",
  hashlock: "0x1a2b3c...",
  deadline: "2024-01-01T13:00:00.000Z"
}

🔄 Testing ICP Service...
✅ ICP Service initialized. Authenticated: false

🎉 All tests completed successfully!
```

**5. Key Testnet Tokens (Sepolia)**

- USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- WETH: `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`
- ETH: `0x0000000000000000000000000000000000000000`

---

## 📋 Roadmap

### Phase 1: Core HTLC ✅
- [x] ICP resolver canister
- [x] HTLC escrow logic
- [x] ECDSA key derivation  
- [x] Comprehensive testing

### Phase 2: EVM Integration 🚧
- [ ] 1inch Fusion+ order monitoring
- [ ] EVM escrow deployment
- [ ] Cross-chain event detection
- [ ] Wallet canister funding

### Phase 3: Crownie Relayer 📋
- [ ] Video meeting integration
- [ ] Social consensus mechanism
- [ ] Threshold secret sharing
- [ ] Live verification extension

### Phase 4: Production 📋  
- [ ] Mainnet deployment
- [ ] Multi-chain support
- [ ] Advanced fee models
- [ ] Governance integration

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`cargo test && npm test`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

- **Documentation**: [Crownie Docs](https://docs.crownie.io)
- **Discord**: [Join our community](https://discord.gg/crownie)  
- **Issues**: [GitHub Issues](https://github.com/crownie/fusion-bridge/issues)
- **Email**: support@crownie.io

---

## ⚖️ Disclaimer

This software is experimental and under active development. Use at your own risk. Always test thoroughly before mainnet deployment.

**Security Audit Status**: 🔄 Pending  
**Mainnet Ready**: ❌ Development only  
**Bug Bounty**: 📋 Coming soon

---

*Built with ❤️ by the Crownie team*