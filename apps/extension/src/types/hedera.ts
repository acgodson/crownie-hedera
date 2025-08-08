export interface HederaNetwork {
  name: 'testnet' | 'mainnet';
  nodeAccountId: string;
  nodeEndpoint: string;
  mirrorNodeUrl: string;
}

export interface HederaAccount {
  accountId: string;
  publicKey: string;
  privateKey?: string;
  balance?: number;
  isActive: boolean;
}

export interface HCSTopic {
  topicId: string;
  meetingId: string;
  createdAt: number;
  lastMessageTimestamp?: number;
  messageCount: number;
  isActive: boolean;
}

export interface HCSMessageMetadata {
  topicId: string;
  consensusTimestamp: string;
  sequenceNumber: number;
  runningHash: string;
  messageSize: number;
}

export interface HCSSubmissionResult {
  transactionId: string;
  topicId: string;
  messageId: string;
  consensusTimestamp?: string;
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

export interface HederaTransactionConfig {
  maxTransactionFee: number;
  nodeAccountId: string;
  regenerateTransactionId?: boolean;
}

export interface MirrorNodeQuery {
  topicId: string;
  sequenceNumber?: number;
  timestamp?: string;
  limit?: number;
  order?: 'asc' | 'desc';
}

export interface MirrorNodeResponse {
  messages: {
    consensus_timestamp: string;
    message: string;
    payer_account_id: string;
    running_hash: string;
    running_hash_version: number;
    sequence_number: number;
    topic_id: string;
  }[];
  links: {
    next: string | null;
  };
}