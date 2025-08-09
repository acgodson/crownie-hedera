import "dotenv/config";
import { HederaWallet } from "../tests/wallet";
import { hederaConfig } from "../tests/config";
import {
  AccountId,
  PrivateKey,
  TokenAssociateTransaction,
  TokenId,
} from "@hashgraph/sdk";

function pow10(decimals: number): bigint {
  let result = 1n;
  for (let i = 0; i < decimals; i++) result *= 10n;
  return result;
}

async function associateRecipientIfNeeded(
  wallet: HederaWallet,
  recipient: string,
  recipientKeyHex?: string,
  tokenIds: string[] = []
) {
  if (!recipientKeyHex) return; // cannot auto-associate without recipient's key

  const recipientId = recipient.match(/^0x/)
    ? AccountId.fromEvmAddress(0, 0, recipient)
    : AccountId.fromString(recipient);

  const notAssociated: string[] = [];
  for (const tokenId of tokenIds) {
    const associated = await wallet.isAccountAssociated(recipient, tokenId);
    if (!associated) notAssociated.push(tokenId);
  }

  if (notAssociated.length === 0) return;

  console.log(`🔗 Auto-associating target with ${notAssociated.length} tokens...`);
  const recipientKey = (() => {
    try {
      return PrivateKey.fromString(recipientKeyHex);
    } catch {
      try {
        return PrivateKey.fromStringDer(recipientKeyHex);
      } catch {
        try {
          return PrivateKey.fromStringECDSA(recipientKeyHex);
        } catch {
          return PrivateKey.fromStringED25519(recipientKeyHex);
        }
      }
    }
  })();

  const tx = new TokenAssociateTransaction()
    .setAccountId(recipientId)
    .setTokenIds(notAssociated.map((id) => TokenId.fromString(id)))
    .freezeWith(wallet.client);

  const signed = await tx.sign(recipientKey);
  const resp = await signed.execute(wallet.client);
  const receipt = await resp.getReceipt(wallet.client);
  console.log(`✅ Recipient association status: ${receipt.status}`);
}

async function main() {
  const wallet = new HederaWallet();

  try {
    const target = process.env.FUND_TARGET || ""; // AccountId like 0.0.x or EVM 0x...
    if (!target) {
      throw new Error("FUND_TARGET env var is required (AccountId e.g. 0.0.x or EVM 0x... address)");
    }

    const tokenSymbolRaw = process.env.FUND_TOKEN || "";
    const tokenSymbol = tokenSymbolRaw.toUpperCase(); // USDT or USDC
    const amountStr = process.env.FUND_AMOUNT || "0"; // in base units (int)
    const fundHbarStrRaw = process.env.FUND_HBAR || "0"; // optional HBAR amount
    const recipientKeyOpt = process.env.FUND_TARGET_KEY || undefined; // optional: auto-associate

    const tokenMap: Record<string, { tokenId: string; decimals: number; symbol: string }> = {
      USDT: {
        tokenId: hederaConfig.tokens.TokenA.tokenId,
        decimals: hederaConfig.tokens.TokenA.decimals,
        symbol: hederaConfig.tokens.TokenA.symbol,
      },
      USDC: {
        tokenId: hederaConfig.tokens.TokenB.tokenId,
        decimals: hederaConfig.tokens.TokenB.decimals,
        symbol: hederaConfig.tokens.TokenB.symbol,
      },
    };

    console.log("👛 Operator:", hederaConfig.operatorId);
    console.log("➡️ Target:", target);

    // Handle HBAR funding (cap at 5 HBAR)
    if (fundHbarStrRaw && fundHbarStrRaw !== "0") {
      const hbarAmount = Math.min(Number(fundHbarStrRaw), 5);
      console.log(`💸 Funding HBAR: ${hbarAmount} HBAR (capped at 5)`);
      await wallet.transferHbarTo(
        target.match(/^0x/) ? AccountId.fromEvmAddress(0, 0, target).toString() : target,
        String(hbarAmount)
      );
    }

    if (!tokenSymbol) {
      console.log("No FUND_TOKEN specified. Skipping token transfer.");
      return;
    }

    const tokenInfo = tokenMap[tokenSymbol];
    if (!tokenInfo) {
      throw new Error(`Unsupported FUND_TOKEN: ${tokenSymbolRaw}. Use USDT or USDC.`);
    }

    // Cap token amount at 5 tokens (in base units)
    const requestedBase = BigInt(amountStr);
    const maxBase = 5n * pow10(tokenInfo.decimals);
    const amountBase = requestedBase > maxBase ? maxBase : requestedBase;
    if (requestedBase !== amountBase) {
      console.log(`⚠️ Capping token amount to ${maxBase} base units (5 tokens max)`);
    }

    console.log(`💰 Funding token ${tokenInfo.symbol} (${tokenInfo.tokenId}) amount: ${amountBase} base units`);

    // Auto-associate if not associated and we have recipient key
    await associateRecipientIfNeeded(wallet, target, recipientKeyOpt, [tokenInfo.tokenId]);

    const associated = await wallet.isAccountAssociated(target, tokenInfo.tokenId);
    if (!associated) {
      throw new Error(
        `Target ${target} is not associated with token ${tokenInfo.tokenId}. ` +
          (recipientKeyOpt ? "Auto-association failed. Please check FUND_TARGET_KEY." : "Provide FUND_TARGET_KEY or have the user associate.")
      );
    }

    await wallet.transferTokenTo(target, tokenInfo.tokenId, amountBase);
    console.log("✅ Funding complete");
  } catch (err) {
    console.error("❌ Funding failed:", err);
    process.exit(1);
  } finally {
    await wallet.close();
  }
}

if (require.main === module) {
  main();
} 