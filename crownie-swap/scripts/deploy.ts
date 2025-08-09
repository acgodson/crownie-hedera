import "dotenv/config";
import { parseUnits } from "ethers";
import { HederaWallet } from "../tests/wallet";
import { hederaConfig } from "../tests/config";

// Import your compiled contract artifacts
import HederaResolverArtifact from "../dist/contracts/Resolver.sol/HederaResolver.json";

async function main() {
  console.log("🚀 Starting Hedera deployment...");

  const wallet = new HederaWallet();

  try {
    console.log("💰 Checking account balance...");
    const balance = await wallet.getHederaBalance();
    console.log(`Account ${hederaConfig.operatorId} balance: ${balance}`);

    const address = await wallet.getAddress();
    console.log(`EVM address: ${address}`);

    // Associate with test tokens
    console.log("🔗 Associating with test tokens...");
    const tokenIds = [
      hederaConfig.tokens.TokenA.tokenId,
      hederaConfig.tokens.TokenB.tokenId,
    ];

    try {
      await wallet.associateWithTokens(tokenIds);
    } catch (err) {
      console.warn("⚠️ Token association failed. Continuing without association.");
      console.warn(String(err));
    }

    // Check token balances
    console.log("📊 Checking token balances...");
    for (const token of Object.values(hederaConfig.tokens)) {
      const balance = await wallet.getTokenBalance(token.tokenId);
      console.log(`${token.symbol} balance: ${balance.toString()}`);
    }

    // Deploy HederaResolver contract
    console.log("📋 Deploying HederaResolver...");

    const creationFee = parseUnits(hederaConfig.creationFee, 18);
    const constructorParams = [address, creationFee];

    // For Hedera, you'll need to use the compiled bytecode
    // This assumes you have the bytecode in your artifact
    const contractAddress = await wallet.deployContract(
      HederaResolverArtifact.bytecode.object,
      HederaResolverArtifact.abi,
      constructorParams,
      8000000 // Higher gas limit for contract deployment
    );

    console.log("✅ Deployment completed!");
    console.log("📄 Contract addresses:");
    console.log(`  HederaResolver: ${contractAddress}`);

    // Save deployment info
    const deploymentInfo = {
      network: hederaConfig.network,
      chainId: hederaConfig.chainId,
      deployer: address,
      contracts: {
        HederaResolver: contractAddress,
      },
      tokens: hederaConfig.tokens,
      timestamp: new Date().toISOString(),
    };

    console.log("\n📋 Deployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    // Test basic contract functionality
    console.log("\n🧪 Testing basic contract functions...");

    try {
      // Test reading contract state
      const owner = await wallet.readContract(
        contractAddress,
        HederaResolverArtifact.abi,
        "owner"
      );
      console.log(`Contract owner: ${owner}`);

      const creationFeeRead = await wallet.readContract(
        contractAddress,
        HederaResolverArtifact.abi,
        "CREATION_FEE"
      );
      console.log(`Creation fee: ${creationFeeRead.toString()}`);

      console.log("✅ Contract deployment and basic tests successful!");
    } catch (error) {
      console.error("❌ Contract test failed:", error);
    }
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  } finally {
    await wallet.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Deployment script failed:", error);
    process.exit(1);
  });
}
