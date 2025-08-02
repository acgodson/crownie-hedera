🧪 How to Test Your Fusion-ICP Bridge on Sepolia

  1. Get Required API Keys & Setup

  # 1. Get 1inch Developer Portal API Key
  # Visit: https://portal.1inch.dev/
  # Sign up and create an API key

  # 2. Get Sepolia Testnet ETH
  # Visit: https://faucets.chain.link/sepolia
  # Get testnet ETH for gas fees

  # 3. Setup environment
  cp .env.example .env
  # Fill in your actual values

  2. Install Dependencies & Run Tests

  # Install all workspace dependencies
  pnpm install

  # Run the bridge tests
  cd bridges/fusion-icp-bridge
  npm run test:fusion

  3. What the Tests Do

  ✅ FusionService Test:
  - Tests quote generation on Sepolia testnet
  - Uses real Sepolia token addresses (USDC → ETH)
  - Validates pricing and gas estimation

  ✅ Cross-Chain Order Test:
  - Creates HTLC with hashlock/secret
  - Tests cross-chain order structure
  - Validates deadline and order ID generation

  ✅ ICP Service Test:
  - Initializes ICP canister connection
  - Tests authentication flow
  - Validates service readiness

  4. Expected Output

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

  5. Key Testnet Tokens (Sepolia)

  - USDC: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
  - WETH: 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
  - ETH: 0x0000000000000000000000000000000000000000