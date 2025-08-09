import { z } from "zod";
import * as process from "node:process";

const ConfigSchema = z.object({
  HEDERA_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  HEDERA_OPERATOR_ID: z.string(),
  HEDERA_OPERATOR_KEY: z.string(),
  EVM_PRIVATE_KEY: z.string().optional(),
  CREATION_FEE: z.string().default("0"),
});

const fromEnv = ConfigSchema.parse(process.env);

export const hederaConfig = {
  network: fromEnv.HEDERA_NETWORK,
  operatorId: fromEnv.HEDERA_OPERATOR_ID,
  operatorKey: fromEnv.HEDERA_OPERATOR_KEY,
  evmPrivateKey: fromEnv.EVM_PRIVATE_KEY || fromEnv.HEDERA_OPERATOR_KEY,
  creationFee: fromEnv.CREATION_FEE,

  jsonRpcUrl:
    fromEnv.HEDERA_NETWORK === "testnet"
      ? "https://testnet.hashio.io/api"
      : "https://mainnet.hashio.io/api",
  chainId: fromEnv.HEDERA_NETWORK === "testnet" ? 296 : 295,

  tokens: {
    TokenA: {
      name: "Crownie USDT ",
      symbol: "USDT",
      decimals: 8,
      tokenId: "0.0.6534710",
      address: "0x000000000000000000000000000000000063b636",
    },
    TokenB: {
      name: "Crownie USDC ",
      symbol: "USDc",
      decimals: 8,
      tokenId: "0.0.6534747",
      address: "0x000000000000000000000000000000000063b65b",
    },
  },
};

export type HederaConfig = typeof hederaConfig;
