import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll, jest } from "@jest/globals";
import {
  parseUnits,
  randomBytes,
  keccak256,
  toUtf8Bytes,
  AbiCoder,
  Contract,
} from "ethers";
import { uint8ArrayToHex } from "@1inch/byte-utils";
import { HederaWallet } from "./wallet";
import { hederaConfig } from "./config";

import HederaResolverArtifact from "../dist/contracts/Resolver.sol/HederaResolver.json";

jest.setTimeout(600000);

const RUN_LIVE_SWAP = process.env.HEDERA_RUN_SWAP === "true";

describe("Hedera Token Service Swap Tests", () => {
  let wallet: HederaWallet;
  let resolverAddress: string;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    console.log("🚀 Setting up Hedera test environment...");

    wallet = new HederaWallet();

    // Get contract address from environment or deploy
    resolverAddress = process.env.HEDERA_RESOLVER_ADDRESS || "";

    if (!resolverAddress) {
      console.log("📋 No resolver address provided, deploying new contract...");

      const address = await wallet.getAddress();
      const creationFee = parseUnits(hederaConfig.creationFee, 18);

      resolverAddress = await wallet.deployContract(
        HederaResolverArtifact.bytecode.object,
        HederaResolverArtifact.abi,
        [address, creationFee],
        8000000
      );
    }

    console.log(`Using resolver at: ${resolverAddress}`);

    // Set token addresses
    tokenA = hederaConfig.tokens.TokenA.address;
    tokenB = hederaConfig.tokens.TokenB.address;

    console.log(`TokenA (${hederaConfig.tokens.TokenA.symbol}): ${tokenA}`);
    console.log(`TokenB (${hederaConfig.tokens.TokenB.symbol}): ${tokenB}`);

    // Associate with tokens if not already associated
    console.log("🔗 Ensuring token associations...");
    await wallet.associateWithTokens([
      hederaConfig.tokens.TokenA.tokenId,
      hederaConfig.tokens.TokenB.tokenId,
    ]);

    // Check initial balances
    console.log("💰 Checking initial token balances...");
    const balanceA = await wallet.getTokenBalance(
      hederaConfig.tokens.TokenA.tokenId
    );
    const balanceB = await wallet.getTokenBalance(
      hederaConfig.tokens.TokenB.tokenId
    );

    console.log(
      `${hederaConfig.tokens.TokenA.symbol} balance: ${balanceA.toString()}`
    );
    console.log(
      `${hederaConfig.tokens.TokenB.symbol} balance: ${balanceB.toString()}`
    );

    if (balanceA === 0n || balanceB === 0n) {
      console.warn(
        "⚠️ Warning: Low token balances detected. You may need to fund your account with test tokens."
      );
    }

    console.log("✅ Test setup completed!");
  });

  afterAll(async () => {
    if (wallet) {
      await wallet.close();
    }
  });

  describe("Hedera Token Service Swap Operations", () => {
    const maybeIt = RUN_LIVE_SWAP ? it : it.skip;

    maybeIt("should complete a successful token swap using HTS", async () => {
      console.log("🔄 Starting HTS token swap test...");

      // Generate swap parameters that don't depend on balances yet
      const secret = randomBytes(32);
      const secretHex = uint8ArrayToHex(secret);
      const hashLock = keccak256(secret);

      // Get initial balances first
      const initialBalanceA = await wallet.getTokenBalance(
        hederaConfig.tokens.TokenA.tokenId
      );
      const initialBalanceB = await wallet.getTokenBalance(
        hederaConfig.tokens.TokenB.tokenId
      );

      console.log("📊 Initial balances:");
      console.log(`TokenA: ${initialBalanceA.toString()}`);
      console.log(`TokenB: ${initialBalanceB.toString()}`);

      // Choose minimal spendable amounts in base units to work with small balances
      if (initialBalanceA <= 0n) {
        throw new Error(`Insufficient TokenA balance. Need at least 1 base unit, Have: ${initialBalanceA}`);
      }
      if (initialBalanceB <= 0n) {
        throw new Error(`Insufficient TokenB balance. Need at least 1 base unit, Have: ${initialBalanceB}`);
      }

      const makerAmount = 1n; // 1 base unit
      const takerAmount = 1n; // 1 base unit

      // Timelock, nonce, salt
      const timelock = Math.floor(Date.now() / 1000) + 3700; // 1 hour from now
      const nonce = Math.floor(Math.random() * 1000000);
      const salt = keccak256(toUtf8Bytes(`hts_salt_${Date.now()}`));

      const userAddress = await wallet.getAddress();

      const order = {
        maker: userAddress,
        makerToken: hederaConfig.tokens.TokenA.address,
        makerAmount: makerAmount,
        takerToken: hederaConfig.tokens.TokenB.address,
        takerAmount: takerAmount,
        hashLock: hashLock,
        timelock: timelock,
        nonce: nonce,
        salt: salt,
      };

      // Generate order hash
      const orderHash = keccak256(
        AbiCoder.defaultAbiCoder().encode(
          [
            "address",
            "address",
            "uint256",
            "address",
            "uint256",
            "bytes32",
            "uint256",
            "uint256",
            "bytes32",
          ],
          [
            order.maker,
            order.makerToken,
            order.makerAmount,
            order.takerToken,
            order.takerAmount,
            order.hashLock,
            order.timelock,
            order.nonce,
            order.salt,
          ]
        )
      );

      console.log(`Generated order hash: ${orderHash}`);

      // Get predicted escrow addresses
      const [predictedMakerEscrow, predictedTakerEscrow] =
        await wallet.readContract(
          resolverAddress,
          HederaResolverArtifact.abi,
          "computeEscrowAddresses",
          [orderHash, salt]
        );

      console.log(`Predicted maker escrow: ${predictedMakerEscrow}`);
      console.log(`Predicted taker escrow: ${predictedTakerEscrow}`);

      // Step 1: Create order
      console.log("📝 Creating order...");
      const createTx = await wallet.callContract(
        resolverAddress,
        HederaResolverArtifact.abi,
        "createOrder",
        [order],
        { value: parseUnits(hederaConfig.creationFee, 18), gasLimit: 3000000 }
      );

      console.log(`Order created! Tx hash: ${createTx.hash}`);

      // Parse events to get actual escrow addresses
      const resolverContract = new Contract(
        resolverAddress,
        HederaResolverArtifact.abi,
        wallet.provider
      );

      const orderCreatedEvent = createTx.logs?.find((log: any) => {
        try {
          const decoded = resolverContract.interface.parseLog(log);
          return decoded?.name === "OrderCreated";
        } catch {
          return false;
        }
      });

      if (!orderCreatedEvent) {
        throw new Error("OrderCreated event not found");
      }

      const decodedEvent =
        resolverContract.interface.parseLog(orderCreatedEvent);
      const eventOrderHash = decodedEvent?.args[0];
      const makerEscrowAddress = decodedEvent?.args[2];
      const takerEscrowAddress = decodedEvent?.args[3];

      console.log(`✅ Order created with hash: ${eventOrderHash}`);
      console.log(`Maker escrow: ${makerEscrowAddress}`);
      console.log(`Taker escrow: ${takerEscrowAddress}`);

      // Step 2: Fill order (same user acting as taker for simplicity)
      console.log("🤝 Filling order...");
      const fillTx = await wallet.callContract(
        resolverAddress,
        HederaResolverArtifact.abi,
        "fillOrder",
        [eventOrderHash, order],
        { gasLimit: 3000000 }
      );

      console.log(`Order filled! Tx hash: ${fillTx.hash}`);

      // Step 3: Complete swap
      console.log("✨ Completing swap...");
      const completeTx = await wallet.callContract(
        resolverAddress,
        HederaResolverArtifact.abi,
        "completeSwap",
        [eventOrderHash, secretHex],
        { gasLimit: 3000000 }
      );

      console.log(`Swap completed! Tx hash: ${completeTx.hash}`);

      // Check final balances
      const finalBalanceA = await wallet.getTokenBalance(
        hederaConfig.tokens.TokenA.tokenId
      );
      const finalBalanceB = await wallet.getTokenBalance(
        hederaConfig.tokens.TokenB.tokenId
      );

      console.log("📊 Final balances:");
      console.log(`TokenA: ${finalBalanceA.toString()}`);
      console.log(`TokenB: ${finalBalanceB.toString()}`);

      console.log("✅ HTS token swap completed successfully!");

      // Verify order status
      const orderStatus = await wallet.readContract(
        resolverAddress,
        HederaResolverArtifact.abi,
        "getOrderStatus",
        [eventOrderHash]
      );

      expect(orderStatus.exists).toBe(true);
      expect(orderStatus.completed).toBe(true);
      expect(orderStatus.cancelled).toBe(false);

      console.log("✅ Order status verification passed!");
    });

    it("should handle token association requirements", async () => {
      console.log("🔗 Testing token association requirements...");

      // This test verifies that the wallet is properly associated with tokens
      const tokenIds = [
        hederaConfig.tokens.TokenA.tokenId,
        hederaConfig.tokens.TokenB.tokenId,
      ];

      for (const tokenId of tokenIds) {
        const balance = await wallet.getTokenBalance(tokenId);
        console.log(`Token ${tokenId} balance: ${balance.toString()}`);

        // If we can query the balance without error, association is working
        expect(typeof balance).toBe("bigint");
      }

      console.log("✅ Token association test passed!");
    });

    it("should verify escrow address prediction", async () => {
      console.log("🔍 Testing escrow address prediction...");

      const testOrderHash = keccak256(toUtf8Bytes("test"));
      const testSalt = keccak256(toUtf8Bytes("test_salt"));

      const [makerEscrow, takerEscrow] = await wallet.readContract(
        resolverAddress,
        HederaResolverArtifact.abi,
        "computeEscrowAddresses",
        [testOrderHash, testSalt]
      );

      console.log(`Predicted maker escrow: ${makerEscrow}`);
      console.log(`Predicted taker escrow: ${takerEscrow}`);

      // Verify addresses are valid Ethereum addresses
      expect(makerEscrow).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(takerEscrow).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(makerEscrow).not.toBe(takerEscrow);

      console.log("✅ Escrow address prediction test passed!");
    });
  });
});
