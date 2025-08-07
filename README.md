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

1. **Clone & Setup**
```bash
git clone https://github.com/acgodson/crownie-hedera
cd crownie-swap
pnpm install
```

```bash

cp .env.example .env
# Fill in private Key of Testnet account with  USDC, USDT, HBAR
npm run test
```

**Use cases**
-  Multi-Sig Wallet Approvals
-  Multi-Party Consent for Escrow Swaps
-  Live Streaming Auctions
-  KYC-Free P2P Escrows for Small Teams or Friends
-  DAO treasury management
-  Community-coordinated asset redistribution.


#### Contracts

Resolver Contract: [`0.0.0`]('')