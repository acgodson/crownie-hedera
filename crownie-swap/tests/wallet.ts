import {
  Client,
  AccountId,
  PrivateKey,
  TokenAssociateTransaction,
  TransferTransaction,
  AccountBalanceQuery,
  TokenId,
  Hbar,
  Status,
} from "@hashgraph/sdk";
import {
  JsonRpcProvider,
  Wallet as EthersWallet,
  Contract,
  ContractFactory,
  parseUnits,
} from "ethers";
import { hederaConfig } from "./config";

// Add robust private key parsing to support DER, ECDSA, and ED25519 formats
function parseOperatorPrivateKey(keyString: string): PrivateKey {
  const tryParsers: Array<(k: string) => PrivateKey> = [
    (k) => PrivateKey.fromString(k),
    (k) => PrivateKey.fromStringDer(k),
    (k) => PrivateKey.fromStringECDSA(k),
    (k) => PrivateKey.fromStringED25519(k),
  ];

  const candidates = new Set<string>();
  candidates.add(keyString);
  if (!keyString.startsWith("0x")) {
    candidates.add(`0x${keyString}`);
  }
  // If string looks like hex DER (starts with 302e... or 302d/3030...), try raw without 0x too
  const normalized = keyString.startsWith("0x") ? keyString.slice(2) : keyString;
  if (/^30[2-3][0-9a-fA-F]{2}/.test(normalized)) {
    candidates.add(normalized);
  }

  for (const candidate of candidates) {
    for (const parser of tryParsers) {
      try {
        return parser(candidate);
      } catch {
        // continue
      }
    }
  }

  throw new Error("Unable to parse Hedera operator private key. Ensure it is DER, ECDSA, or ED25519 in hex string form.");
}

function toAccountId(accountOrEvm: string): AccountId {
  if (/^0x[a-fA-F0-9]{40}$/.test(accountOrEvm)) {
    return AccountId.fromEvmAddress(0, 0, accountOrEvm);
  }
  return AccountId.fromString(accountOrEvm);
}

export class HederaWallet {
  public client: Client;
  public accountId: AccountId;
  public privateKey: PrivateKey;
  public evmWallet: EthersWallet;
  public provider: JsonRpcProvider;

  constructor() {
    // Initialize Hedera client
    this.client = hederaConfig.network === "testnet" 
      ? Client.forTestnet() 
      : Client.forMainnet();
      
    this.accountId = AccountId.fromString(hederaConfig.operatorId);
    this.privateKey = parseOperatorPrivateKey(hederaConfig.operatorKey);
    
    this.client.setOperator(this.accountId, this.privateKey);

    // Initialize EVM provider and wallet for contract interactions
    this.provider = new JsonRpcProvider(hederaConfig.jsonRpcUrl, {
      chainId: hederaConfig.chainId,
      name: `hedera-${hederaConfig.network}`,
    });
    
    this.evmWallet = new EthersWallet(hederaConfig.evmPrivateKey, this.provider);
  }

  async getAddress(): Promise<string> {
    return this.evmWallet.address;
  }

  async getHederaBalance(): Promise<string> {
    const balance = await new AccountBalanceQuery()
      .setAccountId(this.accountId)
      .execute(this.client);
    
    return balance.hbars.toString();
  }

  async getTokenBalance(tokenId: string): Promise<bigint> {
    try {
      const balance = await new AccountBalanceQuery()
        .setAccountId(this.accountId)
        .execute(this.client);
      
      const tokenBalance = balance.tokens?.get(TokenId.fromString(tokenId));
      return BigInt(tokenBalance?.toString() || "0");
    } catch (error) {
      console.log(`Token balance query failed for ${tokenId}:`, error);
      return 0n;
    }
  }

  async getAccountTokenBalance(accountIdOrEvm: string, tokenId: string): Promise<bigint> {
    try {
      const target = toAccountId(accountIdOrEvm);
      const balance = await new AccountBalanceQuery().setAccountId(target).execute(this.client);
      const tokenBalance = balance.tokens?.get(TokenId.fromString(tokenId));
      return BigInt(tokenBalance?.toString() || "0");
    } catch (error) {
      console.log(`Token balance query failed for ${accountIdOrEvm} / ${tokenId}:`, error);
      return 0n;
    }
  }

  async isAssociated(tokenId: string): Promise<boolean> {
    try {
      const balance = await new AccountBalanceQuery()
        .setAccountId(this.accountId)
        .execute(this.client);
      const associated = balance.tokens?.get(TokenId.fromString(tokenId));
      return typeof associated !== "undefined";
    } catch {
      return false;
    }
  }

  async isAccountAssociated(accountIdOrEvm: string, tokenId: string): Promise<boolean> {
    try {
      const target = toAccountId(accountIdOrEvm);
      const balance = await new AccountBalanceQuery().setAccountId(target).execute(this.client);
      const associated = balance.tokens?.get(TokenId.fromString(tokenId));
      return typeof associated !== "undefined";
    } catch {
      return false;
    }
  }

  async associateWithToken(tokenId: string): Promise<void> {
    console.log(`Associating account ${this.accountId} with token ${tokenId}...`);

    // Skip if already associated
    if (await this.isAssociated(tokenId)) {
      console.log(`✅ Already associated with token ${tokenId}. Skipping.`);
      return;
    }
    
    try {
      const transaction = new TokenAssociateTransaction()
        .setAccountId(this.accountId)
        .setTokenIds([TokenId.fromString(tokenId)])
        .freezeWith(this.client);

      const signedTx = await transaction.sign(this.privateKey);
      const response = await signedTx.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      console.log(`✅ Associated with token ${tokenId}. Status: ${receipt.status}`);
    } catch (error: any) {
      const message = String(error?.message || error);
      if (message.includes("TOKEN_ALREADY_ASSOCIATED") || message.includes("INVALID_SIGNATURE")) {
        console.warn(`⚠️ Association for ${tokenId} returned ${message}. Continuing.`);
        return;
      }
      console.log(`Association with token ${tokenId} failed:`, error);
      throw error;
    }
  }

  async associateWithTokens(tokenIds: string[]): Promise<void> {
    console.log(`Associating account with ${tokenIds.length} tokens...`);
    
    for (const tokenId of tokenIds) {
      await this.associateWithToken(tokenId);
    }
    
    console.log("✅ All token associations completed");
  }

  async transferHbarTo(recipientId: string, amount: string): Promise<void> {
    const transaction = new TransferTransaction()
      .addHbarTransfer(this.accountId, Hbar.fromString(`-${amount}`))
      .addHbarTransfer(AccountId.fromString(recipientId), Hbar.fromString(amount))
      .freezeWith(this.client);

    const signedTx = await transaction.sign(this.privateKey);
    const response = await signedTx.execute(this.client);
    await response.getReceipt(this.client);
    
    console.log(`✅ Transferred ${amount} HBAR to ${recipientId}`);
  }

  async transferTokenTo(recipientAccountOrEvm: string, tokenId: string, amountBaseUnits: bigint): Promise<void> {
    const recipient = toAccountId(recipientAccountOrEvm);

    // Ensure recipient is associated (cannot associate on their behalf without their key)
    const associated = await this.isAccountAssociated(recipient.toString(), tokenId);
    if (!associated) {
      throw new Error(`Recipient ${recipient.toString()} is not associated with token ${tokenId}. Ask them to associate first.`);
    }

    // Hedera SDK expects int64 value for token amount
    const value = Number(amountBaseUnits);
    if (!Number.isSafeInteger(value)) {
      throw new Error("Amount too large to fit into int64 for HTS transfer.");
    }

    const tx = new TransferTransaction()
      .addTokenTransfer(TokenId.fromString(tokenId), this.accountId, -value)
      .addTokenTransfer(TokenId.fromString(tokenId), recipient, value)
      .freezeWith(this.client);

    const signed = await tx.sign(this.privateKey);
    const resp = await signed.execute(this.client);
    const receipt = await resp.getReceipt(this.client);

    console.log(`✅ Transferred ${amountBaseUnits} units of ${tokenId} to ${recipient.toString()}. Status: ${receipt.status}`);
  }

  async deployContract(
    contractBytecode: string,
    contractAbi: any[],
    constructorParams: any[] = [],
    gasLimit: number = 5000000
  ): Promise<string> {
    console.log("🚀 Deploying contract to Hedera...");

    // Use ContractFactory to properly encode constructor args
    const factory = new ContractFactory(contractAbi, contractBytecode, this.evmWallet);
    const contract = await factory.deploy(...constructorParams, { gasLimit });
    const receipt = await contract.deploymentTransaction()?.wait();
    const contractAddress = await contract.getAddress();

    if (!contractAddress) {
      throw new Error("Contract deployment failed - no address returned");
    }

    console.log(`✅ Contract deployed at: ${contractAddress}`);
    return contractAddress;
  }

  async callContract(
    contractAddress: string,
    contractAbi: any[],
    methodName: string,
    params: any[] = [],
    options: { value?: bigint; gasLimit?: number } = {}
  ): Promise<any> {
    const contract = new Contract(contractAddress, contractAbi, this.evmWallet);
    
    const tx = await contract[methodName](...params, {
      value: options.value || 0,
      gasLimit: options.gasLimit || 1000000,
    });
    
    return await tx.wait();
  }

  async readContract(
    contractAddress: string,
    contractAbi: any[],
    methodName: string,
    params: any[] = []
  ): Promise<any> {
    const contract = new Contract(contractAddress, contractAbi, this.provider);
    return await contract[methodName](...params);
  }

  async close(): Promise<void> {
    this.client.close();
  }
}