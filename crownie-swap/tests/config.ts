import { z } from "zod";

import * as process from "node:process";

const bool = z
  .string()
  .transform((v) => v.toLowerCase() === "true")
  .pipe(z.boolean());

const ConfigSchema = z.object({
  SRC_CHAIN_RPC: z.string().url(),
  DST_CHAIN_RPC: z.string().url(),
  SRC_CHAIN_CREATE_FORK: bool.default("true"),
  DST_CHAIN_CREATE_FORK: bool.default("true"),
  DEPLOYER_PRIVATE_KEY: z.string().optional(),
  USER_PRIVATE_KEY: z.string().optional(),
  MARKET_MAKER_PRIVATE_KEY: z.string().optional(),
});

const fromEnv = ConfigSchema.parse(process.env);

export const etherlinkConfig = {
  chainId: 128123,
  url: fromEnv.DST_CHAIN_RPC || "https://node.ghostnet.etherlink.com",
  createFork: fromEnv.DST_CHAIN_CREATE_FORK,
  deployerPrivateKey:
    fromEnv.DEPLOYER_PRIVATE_KEY ||
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  userPrivateKey:
    fromEnv.USER_PRIVATE_KEY ||
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  marketMakerPrivateKey:
    fromEnv.MARKET_MAKER_PRIVATE_KEY ||
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  tokens: {
    TokenA: {
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      address: "0x4C2AA252BEe766D3399850569713b55178934849",
    },
    TokenB: {
      name: "Tether USD",
      symbol: "USDT",
      decimals: 6,
      address: "0xf7f007dc8Cb507e25e8b7dbDa600c07FdCF9A75B",
    },
    WETH: {
      name: "Wrapped Eth",
      symbol: "WETH",
      decimals: 18,
      address: "0x86932ff467A7e055d679F7578A0A4F96Be287861",
    },
  },
};
