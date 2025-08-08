import {
  Client,
  PrivateKey,
  AccountId,
  AccountCreateTransaction,
  Hbar,
  AccountBalanceQuery,
} from "@hashgraph/sdk";
import {
  HederaLangchainToolkit,
  coreConsensusPlugin,
  coreQueriesPlugin,
} from "hedera-agent-kit";
import type { AgentIdentity, AgentConfig, HederaNetwork } from "../types";
import { StorageService } from "../services/StorageService";

export class IdentityManager {
  private client: Client | null = null;
  private toolkit: HederaLangchainToolkit | null = null;
  private identity: AgentIdentity | null = null;

  private readonly NETWORKS: Record<string, HederaNetwork> = {
    testnet: {
      name: "testnet",
      nodeAccountId: "0.0.3",
      nodeEndpoint: "testnet.mirrornode.hedera.com:443",
      mirrorNodeUrl: "https://testnet.mirrornode.hedera.com",
    },
    mainnet: {
      name: "mainnet",
      nodeAccountId: "0.0.3",
      nodeEndpoint: "mainnet.mirrornode.hedera.com:443",
      mirrorNodeUrl: "https://mainnet.mirrornode.hedera.com",
    },
  };

  async initialize(config?: AgentConfig): Promise<AgentIdentity> {
    try {
      let identity = await StorageService.getAgentIdentity();

      if (identity && identity.isInitialized) {
        this.identity = identity;
        await this.initializeClient(identity, config?.network || "testnet");
        await this.updateLastActive();
        return identity;
      }

      throw new Error("No identity found. Please import a private key first.");
    } catch (error) {
      console.error("Failed to initialize agent identity:", error);
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
      let privateKey: PrivateKey;

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
      };

      await this.initializeClient(identity, network);
      await StorageService.saveAgentIdentity(identity);

      this.identity = identity;
      return identity;
    } catch (error) {
      throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      this.client =
        network === "testnet" ? Client.forTestnet() : Client.forMainnet();

      const privateKey = PrivateKey.fromStringDer(identity.privateKey);

      this.client.setOperator(identity.accountId, privateKey);

      this.toolkit = new HederaLangchainToolkit({
        client: this.client,
        configuration: {
          plugins: [coreConsensusPlugin, coreQueriesPlugin],
        },
      });
    } catch (error) {
      throw new Error(`Client init failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  async getIdentity(): Promise<AgentIdentity | null> {
    if (!this.identity) {
      this.identity = await StorageService.getAgentIdentity();
    }
    return this.identity;
  }

  getClient(): Client | null {
    return this.client;
  }

  getToolkit(): HederaLangchainToolkit | null {
    return this.toolkit;
  }

  async updateLastActive(): Promise<void> {
    if (this.identity) {
      this.identity.lastActiveAt = Date.now();
      await StorageService.saveAgentIdentity(this.identity);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.client || !this.identity) {
        return false;
      }

      if (
        this.identity.isInitialized &&
        this.identity.accountId &&
        this.identity.privateKey
      ) {
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  async getAccountBalance(): Promise<number> {
    if (!this.client || !this.identity) {
      throw new Error("Client not initialized");
    }

    try {
      const query = new AccountBalanceQuery().setAccountId(
        this.identity.accountId
      );
      const balance = await query.execute(this.client);
      return balance.hbars.toTinybars().toNumber();
    } catch (error) {
      return 0;
    }
  }

  async resetIdentity(): Promise<void> {
    this.identity = null;
    this.client = null;
    this.toolkit = null;
    await StorageService.clearAgentData();
  }

  getNetworkConfig(network: "testnet" | "mainnet"): HederaNetwork {
    return this.NETWORKS[network];
  }
}
