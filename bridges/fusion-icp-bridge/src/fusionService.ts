import {
  FusionSDK,
  NetworkEnum,
  PrivateKeyProviderConnector,
  OrderStatus,
} from "@1inch/fusion-sdk";
import { createPublicClient, http, createWalletClient, custom } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import type {
  FusionQuoteParams,
  FusionOrderParams,
  SwapQuote,
  CrossChainSwapOrder,
} from "@crownie-bridge/shared-types";

export class FusionService {
  private sdk: FusionSDK;
  private apiKey: string;

  constructor(apiKey: string, network: NetworkEnum = NetworkEnum.ETHEREUM) {
    this.apiKey = apiKey;

    // Initialize with proper provider connector
    const rpcUrl = process.env.ETHEREUM_RPC_URL || `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`;
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl)
    });
    
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: custom(publicClient)
    });
    
    const connector = new PrivateKeyProviderConnector(
      process.env.PRIVATE_KEY || "",
      walletClient as any
    );

    this.sdk = new FusionSDK({
      url: "https://api.1inch.dev/fusion",
      network,
      blockchainProvider: connector,
      authKey: apiKey,
    });
  }

  async getQuote(params: FusionQuoteParams): Promise<SwapQuote> {
    try {
      const quote = await this.sdk.getQuote({
        fromTokenAddress: params.fromTokenAddress,
        toTokenAddress: params.toTokenAddress,
        amount: params.amount,
        walletAddress: params.walletAddress,
        enableEstimate: true,
        slippage: params.slippagePercentage || 1,
      });

      return {
        sellAmount: quote.fromTokenAmount.toString(),
        buyAmount: quote.toTokenAmount,
        price: quote.prices?.usd?.fromToken || "0",
        guaranteedPrice: quote.prices?.usd?.toToken || "0",
        estimatedGas: "0", 
        sources: [], 
      };
    } catch (error) {
      console.error("Failed to get Fusion quote:", error);
      throw new Error(`Quote failed: ${error}`);
    }
  }

  async createOrder(params: FusionOrderParams): Promise<any> {
    try {
      const order = await this.sdk.createOrder({
        fromTokenAddress: params.makerAsset,
        toTokenAddress: params.takerAsset,
        amount: params.amount,
        walletAddress: params.maker,
        slippage: 1,
      });

      return order;
    } catch (error) {
      console.error("Failed to create Fusion order:", error);
      throw new Error(`Order creation failed: ${error}`);
    }
  }

  async submitOrder(
    order: any,
    quoteId: string
  ): Promise<{ orderHash: string }> {
    try {
      const result = await this.sdk.submitOrder(order.order, quoteId);
      return {
        orderHash: result.orderHash,
      };
    } catch (error) {
      console.error("Failed to submit Fusion order:", error);
      throw new Error(`Order submission failed: ${error}`);
    }
  }

  async getOrderStatus(orderHash: string): Promise<OrderStatus> {
    try {
      const status = await this.sdk.getOrderStatus(orderHash);
      return status.status;
    } catch (error) {
      console.error("Failed to get order status:", error);
      throw new Error(`Status check failed: ${error}`);
    }
  }

  // Cross-chain specific methods
  async createCrossChainOrder(
    sellToken: string,
    buyToken: string,
    amount: string,
    walletAddress: string,
    destinationChain: string
  ): Promise<CrossChainSwapOrder> {
    // Generate hashlock for HTLC
    const secret = this.generateSecret();
    const hashlock = await this.hashSecret(secret);

    const quote = await this.getQuote({
      fromTokenAddress: sellToken,
      toTokenAddress: buyToken,
      amount,
      walletAddress,
    });

    const order: CrossChainSwapOrder = {
      orderId: this.generateOrderId(),
      maker: walletAddress,
      sellToken: {
        address: sellToken,
        symbol: "UNKNOWN", // Would need token registry
        decimals: 18,
        chainId: 1 as any,
      },
      buyToken: {
        address: buyToken,
        symbol: "UNKNOWN",
        decimals: 18,
        chainId: destinationChain as any,
      },
      sellAmount: amount,
      buyAmount: quote.buyAmount,
      sourceChain: 1 as any,
      destinationChain: destinationChain as any,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      hashlock,
      secret,
      status: "pending" as any,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return order;
  }

  private generateSecret(): string {
    // Generate 32-byte random secret
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  }

  private async hashSecret(secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  private generateOrderId(): string {
    return (
      "order_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    );
  }
}

let fusionService: FusionService | null = null;

export const getFusionService = (apiKey?: string): FusionService => {
  if (!fusionService && apiKey) {
    fusionService = new FusionService(apiKey);
  }
  if (!fusionService) {
    throw new Error("FusionService not initialized. Provide API key.");
  }
  return fusionService;
};