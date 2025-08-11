import { Client, PrivateKey, AccountId, AccountBalanceQuery } from "@hashgraph/sdk";
import { HederaLangchainToolkit, coreConsensusPlugin, coreQueriesPlugin } from "hedera-agent-kit";
import type { AgentIdentity, AgentConfig } from "../types";
import { StorageService } from "../services/StorageService";

export class IdentityManager {
  private client: any | null = null;
  private toolkit: any | null = null;
  private identity: AgentIdentity | null = null;


  async initialize(config?: AgentConfig): Promise<AgentIdentity> {
    try {
      let identity = await StorageService.getAgentIdentity();

      if (identity && identity.isInitialized) {
        this.identity = identity;
        
        try {
          await this.initializeClient(identity, config?.network || "testnet");
        } catch (clientError) {
          console.error("Client initialization failed:", clientError);
        }
        
        await this.updateLastActive();
        return identity;
      }

      throw new Error("No identity found. Please import a private key and set up your account in the extension popup first.");
    } catch (error) {
      console.error("Failed to initialize:", error);
      throw error;
    }
  }

  async importWithAccountId(
    privateKeyString: string,
    accountId: string,
    network: "testnet" | "mainnet" = "testnet"
  ): Promise<AgentIdentity> {
    if (!accountId || !accountId.trim()) {
      throw new Error('Account ID is required. Please provide your Hedera account ID (e.g., 0.0.123456)');
    }

    try {

      const keyString = privateKeyString.trim();
      let privateKey: any;

      if (keyString.length === 64 && /^[a-fA-F0-9]{64}$/.test(keyString)) {
        privateKey = PrivateKey.fromStringED25519(keyString);
      } else if (keyString.length === 66 && keyString.startsWith('0x')) {
        privateKey = PrivateKey.fromStringED25519(keyString.slice(2));
      } else if (keyString.startsWith('302e020100300506032b6570')) {
        privateKey = PrivateKey.fromStringDer(keyString);
      } else if (keyString.startsWith('3041') || keyString.startsWith('3077')) {
        privateKey = PrivateKey.fromStringDer(keyString);
      } else if (keyString.length === 96 && /^[a-fA-F0-9]{96}$/.test(keyString)) {
        privateKey = PrivateKey.fromStringECDSA(keyString);
      } else {
        try {
          privateKey = PrivateKey.fromStringED25519(keyString);
        } catch {
          try {
            privateKey = PrivateKey.fromStringECDSA(keyString);
          } catch {
            try {
              privateKey = PrivateKey.fromStringDer(keyString);
            } catch {
              throw new Error('Invalid private key format. Please provide a valid ED25519 (64 hex chars), ECDSA (96 hex chars), or DER format private key.');
            }
          }
        }
      }

      const publicKey = privateKey.publicKey;
      const accountIdObj = AccountId.fromString(accountId.trim());
      const finalAccountId = accountIdObj.toString();

      const identity: AgentIdentity = {
        accountId: finalAccountId,
        publicKey: publicKey.toStringDer(),
        privateKey: privateKey.toStringDer(),
        isInitialized: true,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        network: network,
      };

      await StorageService.saveAgentIdentity(identity);
      this.identity = identity;
      await this.initializeClient(identity, network);

      return identity;
    } catch (error) {
      throw error;
    }
  }

  private async initializeClient(
    identity: AgentIdentity,
    network: "testnet" | "mainnet"
  ): Promise<void> {
    if (!identity.privateKey) {
      throw new Error("Private key not found in stored identity");
    }

    try {

      this.client = network === "testnet" ? Client.forTestnet() : Client.forMainnet();
      const privateKey = PrivateKey.fromStringDer(identity.privateKey);
      this.client.setOperator(identity.accountId, privateKey);

      this.toolkit = new HederaLangchainToolkit({
        client: this.client,
        configuration: {
          plugins: [coreConsensusPlugin, coreQueriesPlugin],
          context: {
            accountId: identity.accountId,
          },
        },
      });

      const tools = this.toolkit.getTools();
      const createTopicTool = tools.find((t: any) => t.name === 'create_topic_tool');
      const submitMessageTool = tools.find((t: any) => t.name === 'submit_topic_message_tool');
      
      if (tools.length === 0 || !createTopicTool || !submitMessageTool) {
        throw new Error("Missing required Hedera tools");
      }
    } catch (error) {
      throw new Error(`Client init failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.client || !this.identity) {
      return false;
    }

    try {
      const balanceQuery = new AccountBalanceQuery().setAccountId(this.identity.accountId);
      const balance = await balanceQuery.execute(this.client);
      return balance.hbars.toTinybars().toNumber() > 0;
    } catch (error) {
      return false;
    }
  }

  async getAccountBalance(): Promise<number> {
    if (!this.client || !this.identity) {
      return 0;
    }

    try {
      const balanceQuery = new AccountBalanceQuery().setAccountId(this.identity.accountId);
      const balance = await balanceQuery.execute(this.client);
      return balance.hbars.toTinybars().toNumber();
    } catch (error) {
      return 0;
    }
  }

  private async updateLastActive(): Promise<void> {
    if (this.identity) {
      this.identity.lastActiveAt = Date.now();
      await StorageService.saveAgentIdentity(this.identity);
    }
  }

  getClient(): any | null {
    return this.client;
  }

  getToolkit(): any | null {
    return this.toolkit;
  }

  getIdentity(): AgentIdentity | null {
    return this.identity;
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      this.client.close?.();
      this.client = null;
    }
    this.toolkit = null;
    this.identity = null;
  }
}