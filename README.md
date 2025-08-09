# Crownie 

Crownie is a social consensus layer built into a browser extension that transforms live meetings into secure, coordinated asset swaps using hashlocked escrows and real-time decision making.

![Crownie in Action](apps/web-interface/public/crownie-call.png)

![Crownie Extension States](apps/web-interface/public/extension-screens.png)

**Key Features:**
- **Atomic Swaps**: All-or-nothing guarantees using HTLCs 
- **Social Coordination**: Crownie Extension serves as offchain relayer during live meeting


## Architecture

### Core Components

1. **Escrow Factory Contract**: Deploys and manages HTLC escrows
2. **Resolver Contract**: Orchestrates atomic swaps and manages escrow operations
3. **HTLC Escrows**: Lock assets with hashlock and expiration time guarantees
4. **Crownie Extension**: Offchain live-meeting relayer for secret revelation
5. **Intent-Based Architecture**: Follows 1inch Fusion+ model for efficient swaps

``` 
┌─────────────────────────┐    ┌─────────────────────────┐
│     Smart Contract      │    │    Crownie Extension    │
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


## Testing

### 1) Setup

```bash
# In repo root
pnpm install

# Crownie Swap package
cd crownie-swap
cp .env-example .env
# Edit .env with your Hedera Testnet credentials and tokens
# HEDERA_NETWORK=testnet
# HEDERA_OPERATOR_ID=0.0.xxxxxxx
# HEDERA_OPERATOR_KEY=302e02...
# EVM_PRIVATE_KEY=...        # optional; defaults to HEDERA_OPERATOR_KEY
# CREATION_FEE=0
```

### 2) Build contracts and ensure artifacts
Artifacts are in `crownie-swap/dist/contracts/Resolver.sol/`.

```bash
pnpm test -- --passWithNoTests  # triggers forge build before jest
```

### 3) Deploy Resolver to Hedera
Uses your `.env` operator. Token association errors are logged but do not block deployment.

```bash
pnpm dlx tsx scripts/deploy.ts
# Output will include: HederaResolver address
```

You can also set `HEDERA_RESOLVER_ADDRESS` to reuse a previously deployed resolver.

### 4) Fund accounts with demo token (HBAR, USDT, USDC)
Can optionally auto-associate the recipient if you provide their key.

Env inputs:
- `FUND_TARGET`: Hedera `0.0.x` or EVM `0x...` address
- `FUND_TOKEN`: `USDT` or `USDC` (base units amount)
- `FUND_AMOUNT`: token amount in base units; capped to max 5 tokens
- `FUND_HBAR`: HBAR amount as a number; capped to max 5 HBAR
- `FUND_TARGET_KEY` (optional): recipient private key to auto-associate tokens

Examples:
```bash
# Fund 3 HBAR
FUND_TARGET=0.0.1234 FUND_HBAR=3 pnpm fund

# Fund 2 USDT (8 decimals → 200000000 base units)
FUND_TARGET=0.0.1234 FUND_TOKEN=USDT FUND_AMOUNT=200000000 pnpm fund

# Auto-associate and fund 1 USDC to an EVM address
FUND_TARGET=0xabc... FUND_TARGET_KEY=302e02010030... \
FUND_TOKEN=USDC FUND_AMOUNT=100000000 pnpm fund
```

Notes:
- Recipient must be associated with the token. If `FUND_TARGET_KEY` is set, the script will auto-associate the recipient for the specified token(s).
- Funding caps: max 5 tokens and max 5 HBAR per invocation.

### 5) Run tests
Jest is configured under `crownie-swap/tests`. A resolver address can be injected via `HEDERA_RESOLVER_ADDRESS`.

- Non-live tests (no state-changing HTS calls) run by default:
```bash
HEDERA_RESOLVER_ADDRESS=0xYourResolver pnpm test -- tests/test-hedera-swap.test.ts
```

- Live swap test (creates/fills/completes swap on-chain) is gated by `HEDERA_RUN_SWAP=true`:
```bash
HEDERA_RESOLVER_ADDRESS=0xYourResolver \
HEDERA_RUN_SWAP=true pnpm test -- tests/test-hedera-swap.test.ts
```

Troubleshooting:
- `INVALID_SIGNATURE` during association: ensure the private key format in `.env` is correct (DER or raw). The wallet supports DER/ECDSA/ED25519 parsing.
- Token transfer requires the recipient to be associated with the token. Use `FUND_TARGET_KEY` to auto-associate if you control the recipient key.


**Use cases**
-  Multi-Sig Wallet Approvals
-  Multi-Party Consent for Escrow Swaps
-  Live Streaming Auctions
-  KYC-Free P2P Escrows for Small Teams or Friends
-  DAO treasury management
-  Community-coordinated asset redistribution.


#### Contracts

Resolver Contract: [`/0.0.6534828`]('https://hashscan.io/testnet/contract/0.0.6534828')
  