import { Client, PrivateKey, AccountId, TopicCreateTransaction, TopicMessageSubmitTransaction } from "@hashgraph/sdk";
import type { AgentIdentity } from "../types";

export class DirectHederaService {
  private client: Client | null = null;
  private identity: AgentIdentity | null = null;

  constructor(identity: AgentIdentity) {
    this.identity = identity;
    this.initializeClient();
  }

  private initializeClient(): void {
    if (!this.identity) throw new Error("No identity provided");
    
    this.client = this.identity.network === "testnet" ? Client.forTestnet() : Client.forMainnet();
    const privateKey = PrivateKey.fromStringDer(this.identity.privateKey!);
    this.client.setOperator(this.identity.accountId, privateKey);
  }

  async createTopic(memo?: string): Promise<string> {
    if (!this.client) throw new Error("Client not initialized");

    try {
      const transaction = new TopicCreateTransaction()
        .setTopicMemo(memo || `Crownie meeting topic - ${new Date().toISOString()}`);

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);
      
      if (!receipt.topicId) {
        throw new Error("Topic creation failed - no topic ID returned");
      }

      return receipt.topicId.toString();
    } catch (error) {
      console.error("DirectHederaService: Topic creation failed:", error);
      throw new Error(`Failed to create topic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async submitMessage(topicId: string, message: string): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");

    try {
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(message);

      await transaction.execute(this.client);
    } catch (error) {
      console.error("DirectHederaService: Message submission failed:", error);
      throw new Error(`Failed to submit message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  close(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }
}