import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";

import { createServer, CreateServerReturnType } from "prool";
import { anvil } from "prool/instances";

import {
  ContractFactory,
  Contract,
  JsonRpcProvider,
  parseUnits,
  randomBytes,
  Wallet as SignerWallet,
  keccak256,
  toUtf8Bytes,
  AbiCoder,
} from "ethers";
import { uint8ArrayToHex } from "@1inch/byte-utils";
import assert from "node:assert";
import { etherlinkConfig } from "./config";

import localResolverContract from "../dist/contracts/Resolver.sol/Resolver.json";
import ERC20 from "../dist/contracts/IERC20.sol/IERC20.json";
import { Wallet } from "./wallet";

jest.setTimeout(1000 * 300);

describe("Local Swap Escrow on Etherlink", () => {
  let provider: JsonRpcProvider;
  let node: CreateServerReturnType | undefined;

  let user: SignerWallet;
  let marketMaker: SignerWallet;
  let deployer: SignerWallet;

  let localResolver: string;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    console.log("🚀 Starting test setup...");

    if (etherlinkConfig.createFork) {
      console.log("🔧 Creating local fork with funded accounts...");
      node = createServer({
        instance: anvil({
          forkUrl: etherlinkConfig.url,
          chainId: etherlinkConfig.chainId,
          accounts: 10,
          balance: 1000,
        }),
        limit: 1,
      });
      await node.start();
      const address = node.address();
      assert(address);
      provider = new JsonRpcProvider(
        `http://[${address.address}]:${address.port}/1`,
        etherlinkConfig.chainId,
        {
          cacheTimeout: -1,
          staticNetwork: true,
        }
      );
    } else {
      provider = new JsonRpcProvider(
        etherlinkConfig.url,
        etherlinkConfig.chainId,
        {
          cacheTimeout: -1,
          staticNetwork: true,
        }
      );
    }

    console.log("👛 Initializing wallets...");

    if (etherlinkConfig.createFork) {
      console.log("Using Anvil's built-in funded accounts for fork...");
      const anvilAccounts = [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
      ];
      deployer = new SignerWallet(anvilAccounts[0], provider);
      user = new SignerWallet(anvilAccounts[1], provider);
      marketMaker = new SignerWallet(anvilAccounts[2], provider);
    } else {
      deployer = new SignerWallet(etherlinkConfig.deployerPrivateKey, provider);
      user = new SignerWallet(etherlinkConfig.userPrivateKey, provider);
      marketMaker = new SignerWallet(
        etherlinkConfig.marketMakerPrivateKey,
        provider
      );
    }
    console.log("✅ Wallets initialized");

    console.log("💳 Checking deployer balance for gas fees...");
    const deployerBalance = await provider.getBalance(deployer.address);
    console.log(
      `Deployer balance: ${deployerBalance.toString()} wei (${
        Number(deployerBalance) / 1e18
      } ETH/XTZ)`
    );

    const minBalance = etherlinkConfig.createFork
      ? 100000000000000000n
      : 1000000000000000000n;
    if (deployerBalance < minBalance) {
      const minBalanceEth = Number(minBalance) / 1e18;
      if (etherlinkConfig.createFork) {
        console.warn(
          `⚠️ Low balance in fork (${
            Number(deployerBalance) / 1e18
          } ETH). This might cause issues.`
        );
      } else {
        throw new Error(
          `Insufficient deployer balance. Please fund the deployer wallet with at least ${minBalanceEth} ETH/XTZ`
        );
      }
    }

    tokenA = etherlinkConfig.tokens.TokenA.address;
    tokenB = etherlinkConfig.tokens.TokenB.address;

    console.log(
      `TokenA (${etherlinkConfig.tokens.TokenA.symbol}) address:`,
      tokenA
    );
    console.log(
      `TokenB (${etherlinkConfig.tokens.TokenB.symbol}) address:`,
      tokenB
    );

    console.log("📋 Deploying Resolver contract...");
    const resolverContractFactory = new ContractFactory(
      localResolverContract.abi,
      localResolverContract.bytecode,
      deployer
    );

    console.log("🚀 Sending deployment transaction...");
    const resolverInstance = await resolverContractFactory.deploy(
      deployer.address,
      0,
      { gasLimit: 5000000 }
    );

    console.log("⏳ Waiting for deployment confirmation...");
    await resolverInstance.waitForDeployment();

    localResolver = await resolverInstance.getAddress();
    console.log("✅ Resolver deployed at:", localResolver);

    console.log("💰 Setting up wallet wrappers...");
    const userWallet = new Wallet(user, provider);
    const marketMakerWallet = new Wallet(marketMaker, provider);

    console.log("🔍 Checking initial token balances...");
    const userTokenABalance = await userWallet.tokenBalance(tokenA);
    const marketMakerTokenBBalance = await marketMakerWallet.tokenBalance(
      tokenB
    );

    console.log(
      `User ${etherlinkConfig.tokens.TokenA.symbol} balance:`,
      userTokenABalance.toString()
    );
    console.log(
      `MarketMaker ${etherlinkConfig.tokens.TokenB.symbol} balance:`,
      marketMakerTokenBBalance.toString()
    );

    if (etherlinkConfig.createFork && marketMakerTokenBBalance === 0n) {
      console.log(
        "💰 MarketMaker has no USDT. Attempting to fund from deployer..."
      );

      try {
        const deployerWallet = new Wallet(deployer, provider);
        const deployerTokenBBalance = await deployerWallet.tokenBalance(tokenB);

        if (deployerTokenBBalance > parseUnits("10", 6)) {
          await deployerWallet.transferToken(
            tokenB,
            marketMaker.address,
            parseUnits("10", 6)
          );
          console.log(`✅ Transferred 10 USDT from deployer to MarketMaker`);
        } else {
          console.log(
            "⚠️ Deployer also has insufficient USDT. Attempting to get tokens from known holders..."
          );

          const knownUSDTHolders = [
            "0xF461BCB03860a0C99FB8da815dCb96750a69eF08",
            "0x742D35Cc2bf01E9fCfB75F5e5ab20b1c7d4BcFa2",
          ];

          let funded = false;
          for (const holder of knownUSDTHolders) {
            try {
              const holderBalance = await new Contract(
                tokenB,
                ERC20.abi,
                provider
              ).balanceOf(holder);

              if (holderBalance > parseUnits("10", 6)) {
                await provider.send("anvil_impersonateAccount", [holder]);
                const impersonatedSigner = await provider.getSigner(holder);
                const tokenContract = new Contract(
                  tokenB,
                  ERC20.abi,
                  impersonatedSigner
                );
                await tokenContract.transfer(
                  marketMaker.address,
                  parseUnits("10", 6)
                );
                await provider.send("anvil_stopImpersonatingAccount", [holder]);
                console.log(
                  `✅ Transferred 10 USDT from ${holder} to MarketMaker using impersonation`
                );
                funded = true;
                break;
              }
            } catch (error) {
              console.log(
                `Could not get USDT from ${holder}:`,
                error instanceof Error ? error.message : String(error)
              );
              continue;
            }
          }

          if (!funded) {
            console.log(
              "⚠️ Could not fund MarketMaker with USDT from any source. Test may fail."
            );
          }
        }
      } catch (error) {
        console.log(
          "⚠️ Error funding MarketMaker:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    console.log("🔍 Verifying final token balances after funding...");
    const finalMarketMakerTokenBBalance = await marketMakerWallet.tokenBalance(
      tokenB
    );
    console.log(
      `MarketMaker final ${etherlinkConfig.tokens.TokenB.symbol} balance:`,
      finalMarketMakerTokenBBalance.toString()
    );

    if (finalMarketMakerTokenBBalance === 0n) {
      throw new Error(
        "❌ MarketMaker still has no USDT balance. Cannot proceed with swap tests."
      );
    }

    console.log("✍️ Setting up token approvals...");
    await userWallet.unlimitedApprove(tokenA, localResolver);
    await marketMakerWallet.unlimitedApprove(tokenB, localResolver);
    console.log("✅ Approvals complete");

    console.log("Setup complete!");
  });

  afterAll(async () => {
    try {
      if (provider && !provider.destroyed) {
        provider.destroy();
      }
      if (node) {
        await node.stop();
      }
    } catch (error) {
      console.warn("Error during cleanup:", error);
    }
  });

  describe("Intent-based Swap via Dual Escrow Resolver", () => {
    it("should complete successful swap between tokens using dual escrow", async () => {
      const secret = randomBytes(32);
      const secretHex = uint8ArrayToHex(secret);
      const hashLock = keccak256(secret);

      const makerAmount = parseUnits(
        "1",
        etherlinkConfig.tokens.TokenA.decimals
      );
      const takerAmount = parseUnits(
        "1",
        etherlinkConfig.tokens.TokenB.decimals
      );
      const timelock = Math.floor(Date.now() / 1000) + 3700;
      const nonce = Math.floor(Math.random() * 1000000);
      const salt = keccak256(toUtf8Bytes(`salt_${Date.now()}`));

      const resolverContractInstance = new Contract(
        localResolver,
        localResolverContract.abi,
        user
      ) as any;

      const order = {
        maker: user.address,
        makerToken: tokenA,
        makerAmount: makerAmount,
        takerToken: tokenB,
        takerAmount: takerAmount,
        hashLock: hashLock,
        timelock: timelock,
        nonce: nonce,
        salt: salt,
      };

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
      const [predictedMakerEscrow, predictedTakerEscrow] =
        await resolverContractInstance.computeEscrowAddresses(orderHash, salt);

      console.log("Pre-approving escrow contracts for token transfers...");
      const tokenAContract = new Contract(tokenA, ERC20.abi, user);
      const tokenBContract = new Contract(tokenB, ERC20.abi, marketMaker);

      await tokenAContract.approve(predictedMakerEscrow, makerAmount);
      await tokenBContract.approve(predictedTakerEscrow, takerAmount);
      console.log("✅ Escrow contracts approved");

      const initialUserTokenA = await tokenAContract.balanceOf(user.address);
      const initialUserTokenB = await tokenBContract.balanceOf(user.address);
      const initialMarketMakerTokenA = await tokenAContract.balanceOf(
        marketMaker.address
      );
      const initialMarketMakerTokenB = await tokenBContract.balanceOf(
        marketMaker.address
      );

      console.log("Initial balances:");
      console.log(
        `User TokenA: ${initialUserTokenA}, TokenB: ${initialUserTokenB}`
      );
      console.log(
        `MarketMaker TokenA: ${initialMarketMakerTokenA}, TokenB: ${initialMarketMakerTokenB}`
      );

      console.log("Creating order via resolver...");
      const createTx = await resolverContractInstance.createOrder(order, {
        value: parseUnits("0", 18),
      });
      const createReceipt = await createTx.wait();

      const orderCreatedEvent = createReceipt.logs.find((log: any) => {
        try {
          const decoded = resolverContractInstance.interface.parseLog(log);
          return decoded?.name === "OrderCreated";
        } catch {
          return false;
        }
      });

      if (!orderCreatedEvent) throw new Error("OrderCreated event not found");
      const decodedEvent =
        resolverContractInstance.interface.parseLog(orderCreatedEvent);
      if (!decodedEvent) throw new Error("Failed to decode OrderCreated event");
      const eventOrderHash = decodedEvent.args[0];
      const makerEscrowAddress = decodedEvent.args[2];
      const takerEscrowAddress = decodedEvent.args[3];

      console.log("Order created! OrderHash:", eventOrderHash);
      console.log(
        "MakerEscrow:",
        makerEscrowAddress,
        "TakerEscrow:",
        takerEscrowAddress
      );

      const resolverMarketMakerContract =
        resolverContractInstance.connect(marketMaker);
      console.log("Market maker filling order...");
      const fillTx = await resolverMarketMakerContract.fillOrder(
        eventOrderHash,
        order
      );
      await fillTx.wait();
      console.log("Order filled! Both escrows now have tokens locked.");

      console.log("Completing swap with secret (could be called by anyone)...");
      const completeTx = await resolverContractInstance.completeSwap(
        eventOrderHash,
        secretHex
      );
      await completeTx.wait();
      console.log("Swap completed atomically! Both parties got their tokens.");

      const finalUserTokenA = await tokenAContract.balanceOf(user.address);
      const finalUserTokenB = await tokenBContract.balanceOf(user.address);
      const finalMarketMakerTokenA = await tokenAContract.balanceOf(
        marketMaker.address
      );
      const finalMarketMakerTokenB = await tokenBContract.balanceOf(
        marketMaker.address
      );

      console.log("Final balances:");
      console.log(
        `User TokenA: ${finalUserTokenA}, TokenB: ${finalUserTokenB}`
      );
      console.log(
        `MarketMaker TokenA: ${finalMarketMakerTokenA}, TokenB: ${finalMarketMakerTokenB}`
      );

      expect(initialUserTokenA - finalUserTokenA).toBe(makerAmount);
      expect(finalUserTokenB - initialUserTokenB).toBe(takerAmount);
      expect(finalMarketMakerTokenA - initialMarketMakerTokenA).toBe(
        makerAmount
      );
      expect(initialMarketMakerTokenB - finalMarketMakerTokenB).toBe(
        takerAmount
      );

      console.log("✅ Swap completed successfully!");
    });

    it("should allow cancellation after timelock expires", async () => {
      const secret = randomBytes(32);
      const secretHex = uint8ArrayToHex(secret);
      const hashLock = keccak256(secret);

      const makerAmount = parseUnits(
        "1",
        etherlinkConfig.tokens.TokenA.decimals
      );
      const takerAmount = parseUnits(
        "1",
        etherlinkConfig.tokens.TokenB.decimals
      );
      const timelock = Math.floor(Date.now() / 1000) + 3700;
      const nonce = Math.floor(Math.random() * 1000000);
      const salt = keccak256(toUtf8Bytes(`cancel_salt_${Date.now()}`));

      const resolverContractInstance = new Contract(
        localResolver,
        localResolverContract.abi,
        user
      ) as any;

      const order = {
        maker: user.address,
        makerToken: tokenA,
        makerAmount: makerAmount,
        takerToken: tokenB,
        takerAmount: takerAmount,
        hashLock: hashLock,
        timelock: timelock,
        nonce: nonce,
        salt: salt,
      };

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
      const [predictedMakerEscrow, predictedTakerEscrow] =
        await resolverContractInstance.computeEscrowAddresses(orderHash, salt);

      console.log("Pre-approving escrow contracts for token transfers...");
      const tokenAContract = new Contract(tokenA, ERC20.abi, user);
      await tokenAContract.approve(predictedMakerEscrow, makerAmount);
      console.log("✅ Escrow contracts approved");

      console.log("Creating order for cancellation test...");
      const createTx = await resolverContractInstance.createOrder(order, {
        value: parseUnits("0", 18),
      });
      const createReceipt = await createTx.wait();

      const orderCreatedEvent = createReceipt.logs.find((log: any) => {
        try {
          const decoded = resolverContractInstance.interface.parseLog(log);
          return decoded?.name === "OrderCreated";
        } catch {
          return false;
        }
      });

      if (!orderCreatedEvent) throw new Error("OrderCreated event not found");
      const decodedEvent =
        resolverContractInstance.interface.parseLog(orderCreatedEvent);
      if (!decodedEvent) throw new Error("Failed to decode OrderCreated event");
      const eventOrderHash = decodedEvent.args[0];

      console.log(
        "Order created, checking timelock and fast-forwarding time..."
      );

      const orderStatus = await resolverContractInstance.getOrderStatus(
        eventOrderHash
      );
      const makerEscrowAddress = orderStatus.makerEscrow;

      const makerEscrowContract = new Contract(
        makerEscrowAddress,
        [
          "function cancel() external",
          "function getOrderData() external view returns (tuple(address maker, address token, uint256 amount, bytes32 hashLock, uint256 timelock, bool deposited, bool completed, bool cancelled, address taker))",
        ],
        user
      );

      const escrowData = await makerEscrowContract.getOrderData();
      const currentTime = Math.floor(Date.now() / 1000);
      const timelockDiff = Number(escrowData.timelock) - currentTime;

      console.log(
        `Current time: ${currentTime}, Escrow timelock: ${escrowData.timelock}, Diff: ${timelockDiff} seconds`
      );

      // Fast forward past the timelock
      const timeToIncrease = Math.max(timelockDiff + 60, 3701); // At least 1 minute past timelock
      console.log(`Fast-forwarding time by ${timeToIncrease} seconds...`);
      await provider.send("evm_increaseTime", [timeToIncrease]);
      await provider.send("evm_mine", []); // Mine a block to apply the time change

      console.log("Cancelling expired order directly on maker escrow...");

      const cancelTx = await makerEscrowContract.cancel();
      await cancelTx.wait();
      console.log("✅ Order cancelled successfully via direct escrow call!");
    });

    it("should allow relayer to complete swap with correct secret", async () => {
      const secret = randomBytes(32);
      const secretHex = uint8ArrayToHex(secret);
      const hashLock = keccak256(secret);

      const makerAmount = parseUnits(
        "1",
        etherlinkConfig.tokens.TokenA.decimals
      );
      const takerAmount = parseUnits(
        "1",
        etherlinkConfig.tokens.TokenB.decimals
      );
      const currentBlock = await provider.getBlock("latest");
      const timelock = currentBlock!.timestamp + 3700;
      const nonce = Math.floor(Math.random() * 1000000);
      const salt = keccak256(toUtf8Bytes(`relayer_salt_${Date.now()}`));

      const resolverContractInstance = new Contract(
        localResolver,
        localResolverContract.abi,
        user
      ) as any;

      const order = {
        maker: user.address,
        makerToken: tokenA,
        makerAmount: makerAmount,
        takerToken: tokenB,
        takerAmount: takerAmount,
        hashLock: hashLock,
        timelock: timelock,
        nonce: nonce,
        salt: salt,
      };

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
      const [predictedMakerEscrow, predictedTakerEscrow] =
        await resolverContractInstance.computeEscrowAddresses(orderHash, salt);

      console.log("Pre-approving escrow contracts for token transfers...");
      const tokenAContract = new Contract(tokenA, ERC20.abi, user);
      const tokenBContract = new Contract(tokenB, ERC20.abi, marketMaker);
      await tokenAContract.approve(predictedMakerEscrow, makerAmount);
      await tokenBContract.approve(predictedTakerEscrow, takerAmount);
      console.log("✅ Escrow contracts approved");

      console.log("User creating order...");
      const createTx = await resolverContractInstance.createOrder(order, {
        value: parseUnits("0", 18),
      });
      const createReceipt = await createTx.wait();

      const orderCreatedEvent = createReceipt.logs.find((log: any) => {
        try {
          const decoded = resolverContractInstance.interface.parseLog(log);
          return decoded?.name === "OrderCreated";
        } catch {
          return false;
        }
      });

      if (!orderCreatedEvent) throw new Error("OrderCreated event not found");
      const decodedEvent =
        resolverContractInstance.interface.parseLog(orderCreatedEvent);
      if (!decodedEvent) throw new Error("Failed to decode OrderCreated event");
      const eventOrderHash = decodedEvent.args[0];

      const marketMakerContract = resolverContractInstance.connect(marketMaker);
      console.log("Market maker filling order...");
      await (await marketMakerContract.fillOrder(eventOrderHash, order)).wait();

      const relayerContract = resolverContractInstance.connect(deployer);
      console.log("Relayer completing swap with secret...");
      await (
        await relayerContract.completeSwap(eventOrderHash, secretHex)
      ).wait();

      console.log("✅ Relayer successfully completed swap for both parties!");
    });
  });
});
