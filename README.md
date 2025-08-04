# Crownie - Social Etherlink Assets Bridge

A decentralized atomic swap bridge enabling seamless token transfers on Etherlink using 1inch Fusion+ intent-based model and Hash Time-Locked Contracts (HTLCs). Escrow Factory and Resolver Contracts are hosted on Etherlink, utilizing atomic swaps between source and destination escrows with cryptographic guarantees.

## 🎯 Overview

Crownie implements a trustless atomic swap mechanism on Etherlink, enabling seamless token swaps using the 1inch Fusion+ intent-based model. Assets are locked with a hashlock and expiration time in HTLC escrows, ensuring atomic swaps between source and destination contracts.

**Key Features:**
- ⚡ **Atomic Swaps**: All-or-nothing guarantees using HTLCs on Etherlink
- 🔒 **Trustless**: No custodial risk or centralized control  
- 🌐 **Same-Chain Operations**: Efficient same-chain swaps on Etherlink
- 🎮 **1inch Fusion+ Compatible**: Intent-based architecture with proven infrastructure
- 🤝 **Social Coordination**: Crownie Extension serves as offchain live-meeting relayer
- 🔍 **Live Monitoring**: Extension monitors and reveals secrets for swap fulfillment

## 🏗️ Architecture

### Core Components

1. **Escrow Factory Contract**: Deploys and manages HTLC escrows on Etherlink
2. **Resolver Contract**: Orchestrates atomic swaps and manages escrow operations
3. **HTLC Escrows**: Lock assets with hashlock and expiration time guarantees
4. **Crownie Extension**: Offchain live-meeting relayer for secret revelation
5. **Intent-Based Architecture**: Follows 1inch Fusion+ model for efficient swaps

```
┌─────────────────────────┐    ┌─────────────────────────┐
│     Etherlink Chain     │    │    Crownie Extension    │
│  ┌─────────────────┐    │    │  ┌─────────────────┐    │
│  │ Escrow Factory  │    │    │  │ Live Meeting    │    │
│  │   Contract      │    │◄───┼──┤   Relayer       │    │
│  └─────────────────┘    │    │  └─────────────────┘    │
│  ┌─────────────────┐    │    │  ┌─────────────────┐    │
│  │   Resolver      │    │    │  │ Secret Monitor  │    │
│  │   Contract      │    │    │  │ & Revelation    │    │
│  └─────────────────┘    │    │  └─────────────────┘    │
│  ┌─────────────────┐    │    │                         │
│  │ Source Escrow   │    │    │                         │
│  │   (HTLC)        │    │    │                         │
│  └─────────────────┘    │    │                         │
│  ┌─────────────────┐    │    │                         │
│  │ Destination     │    │    │                         │
│  │ Escrow (HTLC)   │    │    │                         │
│  └─────────────────┘    │    │                         │
└─────────────────────────┘    └─────────────────────────┘
```

## 🔄 Same-Chain Atomic Swap Flow

Let's walk through Bob's journey swapping **1 ETH → 2000 USDC** on Etherlink:

### 1. **Bob Initiates Swap**

Bob wants to swap ETH for USDC on Etherlink using the intent-based model.

**What happens:**
- Bob creates an intent on the Fusion+ system
- Escrow Factory deploys a **source ETH escrow contract** on Etherlink
- Bob locks **1 ETH** in the source escrow with:
  - `secret_hash` = `keccak256(random_secret)`
  - `timelock` = 2 hours expiry
  - `recipient` = resolver address

```solidity
// Source Escrow State (Etherlink)
locked_amount: 1 ETH
secret_hash: 0xabc123...
timelock: block.timestamp + 7200
recipient: resolver_address
```

---

### 2. **Resolver Deploys Destination Escrow**

The **Resolver Contract** on Etherlink detects the source escrow creation and responds to the intent.

**What it does:**
- Creates a matching **USDC destination escrow contract** on Etherlink
- Funds it with **2000 USDC** from its token inventory
- Uses **same cryptographic parameters**:
  - `secret_hash` = same as source escrow  
  - `timelock` = same expiry
  - `recipient` = Bob's address

```solidity
// Destination Escrow State (Etherlink)
locked_amount: 2000 USDC
secret_hash: 0xabc123... // Same as source!
timelock: block.timestamp + 7200
recipient: Bob's_Address
```

✅ **Both escrows are now locked on Etherlink** — atomic swap is ready!

---

### 3. **Crownie Extension Verifies Both Escrows**

Here's where Crownie's **offchain live-meeting relayer** shines:

**The Crownie Extension:**
- Participants join a video meeting about this swap intent
- Extension monitors **both escrows on Etherlink simultaneously**
- Verifies:
  - ✅ ETH is locked in source escrow
  - ✅ USDC is locked in destination escrow  
  - ✅ Same secret_hash on both escrows
  - ✅ Reasonable timelock (prevents rushed decisions)

**Live-Meeting Consensus:**
- Meeting participants collectively verify the swap conditions
- Once verification complete, they vote: **"Safe to proceed"**
- Extension tells Bob: *"Both escrows verified on Etherlink. You can safely reveal your secret."*

---

### 4. **Bob Reveals Secret on Destination Escrow**

Bob trusts the social verification and reveals his secret on the **destination USDC escrow**.

**Transaction:**
```solidity
// Bob calls destination escrow contract
destinationEscrow.claim(secret)

// Contract validates:
if (keccak256(secret) == stored_secret_hash) {
    // Transfer 2000 USDC to Bob's address
    USDC.transfer(recipient, 2000);
    
    // Emit secret in transaction logs for relayer
    emit SecretRevealed(secret);
}
```

🎉 **Bob now has 2000 USDC on Etherlink!**

---

### 5. **Extension Unlocks ETH for Resolver**

The Crownie Extension (or any observer) sees the secret from the destination escrow transaction logs.

**What happens:**
- Extension extracts `secret` from Etherlink transaction logs
- Calls source escrow: `claim(secret)`  
- Source escrow validates `keccak256(secret) == secret_hash`
- **1 ETH** transfers to resolver's address

```solidity
// Source escrow validates and releases
function claim(bytes32 secret) external {
    require(keccak256(secret) == secret_hash, "Invalid secret");
    require(block.timestamp < timelock, "Expired");
    
    payable(resolver).transfer(locked_amount); // 1 ETH to resolver
}
```

✅ **Atomic swap complete on Etherlink!** Both parties got their tokens.

---

### 6. **Swap Complete - Same Chain Benefits**

Since both assets are on Etherlink, Bob enjoys seamless same-chain benefits:

**Immediate Access:**
- Bob can immediately use his **2000 USDC** in Etherlink DeFi
- No cross-chain bridging delays or additional fees
- Direct composability with other Etherlink protocols

**Bob's Options:**
1. **Use in Etherlink DeFi** - Immediate access to lending, yield farming
2. **Further Trading** - Swap USDC for other Etherlink tokens  
3. **Bridge if Needed** - Optional bridging to other chains later

---

## 🛡️ Security Guarantees

### Atomic Swap Properties

**✅ Atomicity**: Either both parties get their tokens OR neither does  
**✅ Consistency**: Same secret unlocks both escrows  
**✅ Isolation**: Escrows are independent until secret reveal  
**✅ Durability**: Blockchain guarantees permanent settlement  

### Attack Prevention

| Attack Vector         | Protection                                                     |
| --------------------- | -------------------------------------------------------------- |
| **Front-running**     | Secret is only revealed after both escrows funded on Etherlink |
| **Griefing**          | Timelock allows refunds if counterparty disappears             |
| **Double-spend**      | Etherlink consensus prevents double-spending                   |
| **Rug pull**          | No custodial control - funds locked in HTLC contracts          |
| **Extension failure** | Anyone can observe secret and complete swap on-chain           |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (for frontend/testing)
- **Hardhat/Foundry** (for Etherlink contract development)  
- **Etherlink RPC** (for blockchain interaction)
- **1inch API Key** (for Fusion+ integration)

### Quick Start

1. **Clone & Setup**
```bash
git clone <repository>
cd crownie-fusion-bridge
npm install
```

2. **Setup Etherlink Environment**
```bash
# Configure Etherlink RPC and network settings
cp .env.example .env
# Fill in Etherlink RPC URL and private keys
```

3. **Deploy Contracts**
```bash
# Deploy Escrow Factory and Resolver contracts to Etherlink
npm run deploy:etherlink
```

4. **Run Tests**
```bash
# Smart contract tests
npm run test:contracts

# Integration tests  
npm run test:integration
```

5. **Test Manually**
```bash
# Test escrow creation on Etherlink
npm run test:escrow

# Monitor swap intents
npm run monitor:swaps

# Test Crownie Extension integration
npm run test:extension
```

---

## 🧪 Testing

### Test Coverage

**✅ Smart Contract Tests**
- HTLC escrow logic validation
- Escrow Factory deployment
- Resolver contract functionality  
- Secret revelation mechanics
- Timelock and refund scenarios

**✅ Integration Tests**  
- Same-chain atomic swap simulation
- Escrow funding verification on Etherlink
- Crownie Extension interaction
- Intent fulfillment flow

**✅ Manual Testing**
```bash
# Test contract deployment
npm run test:deploy

# Test escrow creation
npm run test:create-escrow

# Test atomic swap flow
npm run test:atomic-swap

# Test Extension monitoring
npm run test:extension-monitor
```

### How to Test Your Fusion Bridge on Etherlink

**1. Get Required Setup**

```bash
# 1. Get 1inch Developer Portal API Key
# Visit: https://portal.1inch.dev/
# Sign up and create an API key

# 2. Get Etherlink Testnet Tokens
# Visit Etherlink faucet for testnet ETH and tokens
# Get testnet tokens for swap testing

# 3. Setup environment
cp .env.example .env
# Fill in Etherlink RPC URL and API keys
```

**2. Install Dependencies & Run Tests**

```bash
# Install all workspace dependencies
pnpm install

# Run the bridge tests
npm run test:etherlink
```

**3. What the Tests Do**

✅ **Escrow Factory Test:**
- Tests escrow deployment on Etherlink
- Validates HTLC parameters and funding
- Tests hashlock and timelock mechanics

✅ **Atomic Swap Test:**
- Creates intent-based swap orders
- Tests same-chain atomic swaps
- Validates secret revelation flow

✅ **Extension Test:**
- Tests Crownie Extension monitoring
- Validates live-meeting relayer functionality
- Tests consensus mechanisms

**4. Expected Output**

```
🚀 Starting Etherlink Fusion Bridge Tests

🔄 Testing Escrow Factory...
✅ Escrow deployed: {
  sourceEscrow: "0x1a2b3c...",
  destinationEscrow: "0x4d5e6f...",
  hashlock: "0xabc123..."
}

🔄 Testing Atomic Swap...
✅ Swap completed: {
  swapId: "swap_1704123456_xyz789",
  status: "completed",
  secretRevealed: true
}

🔄 Testing Extension...
✅ Extension monitoring active. Relayer connected.

🎉 All tests completed successfully!
```

**5. Key Testnet Tokens (Etherlink)**

- ETH: `0x0000000000000000000000000000000000000000`
- USDC: `[Etherlink USDC Address]`
- WETH: `[Etherlink WETH Address]`

---

## 📋 Roadmap

### Phase 1: Core HTLC on Etherlink ✅
- [x] Escrow Factory contract
- [x] HTLC escrow logic
- [x] Resolver contract architecture
- [x] Atomic swap mechanics

### Phase 2: Fusion+ Integration 🚧
- [ ] 1inch Fusion+ intent monitoring
- [ ] Same-chain swap optimization
- [ ] Intent fulfillment automation
- [ ] Advanced pricing mechanisms

### Phase 3: Crownie Extension 📋
- [ ] Live-meeting relayer implementation
- [ ] Video conference integration
- [ ] Consensus mechanism for secret revelation
- [ ] Real-time monitoring dashboard

### Phase 4: Production & Scaling 📋  
- [ ] Etherlink mainnet deployment
- [ ] Multi-token support expansion
- [ ] Advanced fee optimization
- [ ] Governance and community features

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