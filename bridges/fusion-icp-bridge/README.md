# Fusion ICP Resolver Backend

A comprehensive cross-chain bridge solution for seamless token swaps between EVM chains and the Internet Computer Protocol (ICP). This package provides pre-built canisters that can be easily integrated into any ICP project without requiring additional coding.

## 🏗️ Architecture Overview

The Fusion ICP Resolver consists of three main components working together to enable secure cross-chain operations:

### 1. **Resolver Canister** (`resolver_canister_backend`)
The main orchestrator that coordinates cross-chain swaps between EVM chains and ICP. It acts as the central hub for:
- Managing swap lifecycles (initiation, funding, execution, completion)
- Generating and storing cryptographic secrets for HTLCs
- Coordinating with EVM blockchain via the EVM RPC canister
- Deploying and managing ICP escrow canisters
- Handling emergency refunds for expired swaps

### 2. **Wallet Canister** (`wallet_canister`)
A secure token management system that:
- Holds ICRC standard tokens (ICP, ckBTC, ckETH, etc.)
- **Restricted Access**: Only allows the resolver canister to trigger transfers
- Manages EVM token transfers via controlled access patterns
- Provides balance checking and transaction capabilities
- Ensures funds are only moved for legitimate swap operations

### 3. **Escrow Factory** (`icp_escrow_canister`)
Deploys Hash Time-Locked Contracts (HTLCs) compatible with the fusion pattern:
- Creates individual escrow canisters for each swap
- Implements atomic swap guarantees using cryptographic hashes
- Supports timelock mechanisms for automatic refunds
- Compatible with EVM escrow contracts for cross-chain coordination
- Handles both deposit and release operations securely

## 🔗 Cross-Chain Integration

### EVM Blockchain Connectivity
The resolver integrates with EVM chains through the **EVM RPC Canister** (`7hfb6-caaaa-aaaar-qadga-cai`):
- **Supported Networks**: Ethereum, Polygon, BSC, and their testnets
- **Smart Contract Interaction**: Deploy and manage escrow contracts
- **Transaction Monitoring**: Track funding and execution states
- **Multi-Chain Configuration**: Easily switch between mainnet and testnet

### Fusion Pattern Compatibility
The system implements the 1inch Fusion pattern for cross-chain swaps:
- **HTLC Escrows**: Both EVM and ICP sides use hash time-locked contracts
- **Atomic Guarantees**: Either both sides complete or both sides refund
- **Secret Management**: Cryptographic secrets ensure trustless execution
- **Timelock Safety**: Automatic refunds prevent fund lockup

## 💰 Token Standards Support

### ICP Side (ICRC Tokens)
- **Native ICP**: Direct support for ICP token transfers
- **ckTokens**: ckBTC, ckETH, ckUSDC and other chain-key tokens
- **ICRC-1/ICRC-2**: Full compatibility with ICP token standards
- **Custom Tokens**: Support for any ICRC-compliant token

### EVM Side
- **Native ETH**: Direct Ethereum transfers
- **ERC-20 Tokens**: USDC, USDT, DAI, and custom tokens
- **Multi-Chain**: Tokens on Ethereum, Polygon, BSC networks

## 🚀 Quick Start

### Prerequisites
- dfx CLI installed and configured
- Node.js 18+ for TypeScript integration
- Rust toolchain for custom modifications (optional)

### Installation

1. **Download the latest release** from GitHub releases
2. **Extract the package** to your project directory
3. **Copy canister files**:
   ```bash
   # Copy WASM files to your project
   cp fusion-icp-resolver-v*/resolver_canister_backend.wasm ./canisters/
   cp fusion-icp-resolver-v*/wallet_canister.wasm ./canisters/
   cp fusion-icp-resolver-v*/icp_escrow_canister.wasm ./canisters/
   
   # Copy Candid interface files
   cp fusion-icp-resolver-v*/resolver_canister_backend.did ./canisters/
   cp fusion-icp-resolver-v*/wallet_canister.did ./canisters/
   cp fusion-icp-resolver-v*/icp_escrow_canister.did ./canisters/
   ```

### Configuration

Add the canisters to your `dfx.json`:

```json
{
  "version": 1,
  "canisters": {
    "resolver_canister_backend": {
      "type": "custom",
      "candid": "canisters/resolver_canister_backend.did",
      "wasm": "canisters/resolver_canister_backend.wasm"
    },
    "wallet_canister": {
      "type": "custom", 
      "candid": "canisters/wallet_canister.did",
      "wasm": "canisters/wallet_canister.wasm"
    },
    "icp_escrow_canister": {
      "type": "custom",
      "candid": "canisters/icp_escrow_canister.did", 
      "wasm": "canisters/icp_escrow_canister.wasm"
    },
    "evm_rpc": {
      "type": "custom",
      "candid": "https://github.com/internet-computer-protocol/evm-rpc-canister/releases/latest/download/evm_rpc.did",
      "wasm": "https://github.com/internet-computer-protocol/evm-rpc-canister/releases/latest/download/evm_rpc.wasm.gz",
      "remote": {
        "id": {
          "ic": "7hfb6-caaaa-aaaar-qadga-cai"
        }
      },
      "init_arg": "(record {})"
    }
  }
}
```

### Network Configuration

#### For Mainnet (Ethereum, Polygon, BSC)
```bash
# Deploy to IC mainnet
dfx deploy --network ic

# Configure for mainnet operations
dfx canister call resolver_canister_backend set_resolver_address \
  '("0x1111111254eeb25477b68fb85ed929f73a960582")' --network ic
```

#### For Testnet (Sepolia, Mumbai, BSC Testnet)
```bash
# Deploy locally or to IC testnet
dfx deploy

# Configure for Sepolia testnet
dfx canister call resolver_canister_backend configure_for_sepolia_testnet --network ic
```

### Wallet Integration

Connect the wallet canister to the resolver:

```bash
# Get wallet canister ID
WALLET_ID=$(dfx canister id wallet_canister)

# Set wallet canister in resolver
dfx canister call resolver_canister_backend set_wallet_canister "($WALLET_ID)"
```

## 🔧 EVM Chain Configuration

The resolver supports multiple EVM chains through configurable settings:

### Supported Networks

| Network | Chain ID | Status |
|---------|----------|---------|
| Ethereum | 1 | ✅ Mainnet |
| Polygon | 137 | ✅ Mainnet |
| BSC | 56 | ✅ Mainnet |
| Sepolia | 11155111 | ✅ Testnet |
| Mumbai | 80001 | ✅ Testnet |
| BSC Testnet | 97 | ✅ Testnet |

### Custom Network Configuration

```typescript
// Configure additional EVM chains
await resolver.set_supported_chains([1, 137, 56, 42161]); // Add Arbitrum

// Set resolver addresses for different networks
await resolver.set_resolver_address("0x1111111254eeb25477b68fb85ed929f73a960582");
```

## 📖 Usage Examples

### Initiating an EVM → ICP Swap

```typescript
import { fusion_icp_resolver } from './declarations/resolver_canister_backend';

// Swap ETH to ckETH
const swapResult = await fusion_icp_resolver.initiate_evm_to_icp_swap(
  "0x742d35cc6435c7a0c9bb8cb2de6bb7eac81b9e8c", // User's ETH address
  "be2us-64aaa-aaaaa-qaabq-cai",                   // User's ICP principal
  "0x0000000000000000000000000000000000000000", // ETH (native token)
  "jzenf-aiaaa-aaaar-qaa7q-cai",                   // ckETH ledger
  BigInt("1000000000000000000"),                    // 1 ETH in wei
  BigInt(3600)                                      // 1 hour timelock
);

console.log("Swap initiated:", swapResult);
console.log("Fund EVM escrow:", swapResult.Ok.source_escrow_address);
```

### Initiating an ICP → EVM Swap

```typescript
// Swap ckBTC to BTC on Ethereum
const swapResult = await fusion_icp_resolver.initiate_icp_to_evm_swap(
  "be2us-64aaa-aaaaa-qaabq-cai",                   // User's ICP principal  
  "0x742d35cc6435c7a0c9bb8cb2de6bb7eac81b9e8c", // User's ETH address
  "mxzaz-hqaaa-aaaar-qaada-cai",                   // ckBTC ledger
  "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC contract
  BigInt("100000000"),                             // 1 BTC in satoshis
  BigInt(7200)                                     // 2 hour timelock
);

console.log("Swap initiated:", swapResult);
console.log("Fund ICP escrow:", swapResult.Ok.source_escrow_address);
```

### Checking Swap Status

```typescript
// Check funding status
const fundingStatus = await fusion_icp_resolver.check_escrow_funding("swap-id-123");
console.log("Funding status:", fundingStatus);

// Get swap details
const swapDetails = await fusion_icp_resolver.get_swap_details("swap-id-123");
console.log("Swap details:", swapDetails);

// List all active swaps
const activeSwaps = await fusion_icp_resolver.get_active_swaps();
console.log("Active swaps:", activeSwaps);
```

## 🛡️ Security Features

### HTLC Security Model
- **Atomic Swaps**: Cryptographic guarantees prevent partial execution
- **Secret-based Unlocking**: Only the resolver can complete swaps
- **Time-locked Refunds**: Automatic return of funds if swaps expire
- **Hash Verification**: Prevents unauthorized access to escrow funds

### Access Control
- **Wallet Restrictions**: Only resolver can trigger wallet transfers  
- **Principal Verification**: Strict identity checking for all operations
- **Escrow Isolation**: Each swap gets its own dedicated escrow canister
- **Emergency Functions**: Built-in refund mechanisms for expired swaps

### Audit Trail
- **Comprehensive Logging**: All operations are logged for transparency
- **State Tracking**: Complete swap lifecycle monitoring
- **Error Handling**: Robust error reporting and recovery mechanisms

## 🚨 Emergency Procedures

### Refunding Expired Swaps

```typescript
// Automatically refund an expired swap
const refundResult = await fusion_icp_resolver.refund_expired_swap("swap-id-123");
console.log("Refund completed:", refundResult);
```

### Monitoring Swap Health

```typescript
// Check if swaps are approaching expiration
const activeSwaps = await fusion_icp_resolver.get_active_swaps();
const currentTime = Date.now() / 1000;

for (const [swapId, swap] of activeSwaps) {
  const timeRemaining = swap.timelock - currentTime;
  if (timeRemaining < 3600) { // Less than 1 hour remaining
    console.warn(`Swap ${swapId} expires in ${timeRemaining} seconds`);
  }
}
```

## 📊 Monitoring and Analytics

### Swap Metrics

```typescript
// Get total number of escrows created
const escrowCount = await fusion_icp_resolver.get_escrow_count();
console.log("Total escrows created:", escrowCount);

// List all created ICP escrows
const icpEscrows = await fusion_icp_resolver.list_created_icp_escrows();
console.log("ICP escrows:", icpEscrows);

// Check resolver configuration
const config = await fusion_icp_resolver.get_config();
console.log("Resolver config:", config);
```

### Health Checks

```typescript
// Verify resolver ETH address
const ethAddress = await fusion_icp_resolver.get_resolver_eth_address();
console.log("Resolver ETH address:", ethAddress);

// Check wallet canister connection
const walletId = config.wallet_canister;
console.log("Connected wallet:", walletId);
```

## 🔄 Upgrade Path

### Updating Canisters

```bash
# Stop the canisters
dfx canister stop resolver_canister_backend
dfx canister stop wallet_canister

# Upgrade with new WASM
dfx canister install resolver_canister_backend --mode upgrade
dfx canister install wallet_canister --mode upgrade

# Restart the canisters  
dfx canister start resolver_canister_backend
dfx canister start wallet_canister
```

### Migration Considerations
- **State Preservation**: Active swaps are maintained during upgrades
- **Version Compatibility**: Ensure WASM versions are compatible
- **Configuration Backup**: Save configuration before upgrades

## 🤝 Contributing

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/crownie
cd crownie/bridges/fusion-icp-bridge

# Install dependencies
npm install

# Build canisters
dfx build

# Run tests
npm test
```

### Testing

```bash
# Unit tests
cargo test

# Integration tests  
npm run test:integration

# End-to-end tests
npm run test:e2e
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: [GitHub Wiki](https://github.com/your-org/crownie/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-org/crownie/issues)  
- **Discussions**: [GitHub Discussions](https://github.com/your-org/crownie/discussions)

## 🔮 Roadmap

- [ ] **zkSync Integration**: Support for zkSync Era and zkSync Lite
- [ ] **Arbitrum & Optimism**: Layer 2 scaling solutions
- [ ] **Bitcoin Integration**: Direct BTC ↔ ICP swaps
- [ ] **Governance Integration**: DAO-based parameter management
- [ ] **Advanced Analytics**: Real-time swap monitoring dashboard
- [ ] **Mobile SDK**: React Native integration for mobile apps

---

Built with ❤️ for the Internet Computer ecosystem