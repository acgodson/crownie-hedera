import { TopicCreateTransaction, TopicMessageSubmitTransaction } from '@hashgraph/sdk';
import { coreConsensusPluginToolNames } from 'hedera-agent-kit';
import type { 
  HCSTopic, 
  HCSMessage, 
  HCSSubmissionResult, 
  TranscriptionChunk,
  MeetingSummary 
} from '../types';
import { StorageService } from './StorageService';
import { IdentityManager } from '../agents/IdentityManager';

export class HCSService {
  private identityManager: IdentityManager;

  constructor(identityManager: IdentityManager) {
    this.identityManager = identityManager;
  }

  async createTopicForMeeting(meetingId: string): Promise<HCSTopic> {
    try {
      const client = this.identityManager.getClient();
      if (!client) {
        throw new Error('Hedera client not initialized');
      }

      const transaction = new TopicCreateTransaction()
        .setTopicMemo(`Meeting: ${meetingId}`);

      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);
      const topicId = receipt.topicId!.toString();

      const topic: HCSTopic = {
        topicId,
        meetingId,
        createdAt: Date.now(),
        messageCount: 0,
        isActive: true
      };

      await StorageService.saveHCSTopic(topic);
      return topic;
    } catch (error) {
      console.error('Failed to create HCS topic:', error);
      throw error;
    }
  }

  async getOrCreateTopicForMeeting(meetingId: string): Promise<HCSTopic> {
    let topic = await StorageService.getHCSTopic(meetingId);
    
    if (!topic) {
      topic = await this.createTopicForMeeting(meetingId);
    }
    
    return topic;
  }

  async publishMessage(
    topicId: string, 
    message: HCSMessage
  ): Promise<HCSSubmissionResult> {
    try {
      const client = this.identityManager.getClient();
      if (!client) {
        throw new Error('Hedera client not initialized');
      }

      const messagePayload = JSON.stringify(message);
      
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(messagePayload);

      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);

      const submissionResult: HCSSubmissionResult = {
        transactionId: response.transactionId.toString(),
        topicId,
        messageId: `${topicId}_${Date.now()}`,
        status: 'success'
      };

      await this.updateTopicMessageCount(message.meetingId);

      return submissionResult;
    } catch (error) {
      console.error('Failed to publish HCS message:', error);
      return {
        transactionId: '',
        topicId,
        messageId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async publishTranscriptionChunk(
    meetingId: string, 
    chunk: TranscriptionChunk
  ): Promise<HCSSubmissionResult> {
    const identity = await this.identityManager.getIdentity();
    if (!identity) {
      throw new Error('Agent identity not found');
    }

    const topic = await this.getOrCreateTopicForMeeting(meetingId);
    
    const message: HCSMessage = {
      type: 'transcription',
      timestamp: Date.now(),
      meetingId,
      agentId: identity.accountId,
      payload: chunk,
      sequenceNumber: topic.messageCount + 1
    };

    return await this.publishMessage(topic.topicId, message);
  }

  async publishMeetingStart(meetingId: string, meetingTitle: string): Promise<HCSSubmissionResult> {
    const identity = await this.identityManager.getIdentity();
    if (!identity) {
      throw new Error('Agent identity not found');
    }

    const topic = await this.getOrCreateTopicForMeeting(meetingId);
    
    const message: HCSMessage = {
      type: 'meeting_start',
      timestamp: Date.now(),
      meetingId,
      agentId: identity.accountId,
      payload: {
        title: meetingTitle,
        startTime: Date.now()
      }
    };

    return await this.publishMessage(topic.topicId, message);
  }

  async publishMeetingEnd(
    meetingId: string, 
    summary: MeetingSummary
  ): Promise<HCSSubmissionResult> {
    const identity = await this.identityManager.getIdentity();
    if (!identity) {
      throw new Error('Agent identity not found');
    }

    const topic = await this.getOrCreateTopicForMeeting(meetingId);
    
    const message: HCSMessage = {
      type: 'meeting_end',
      timestamp: Date.now(),
      meetingId,
      agentId: identity.accountId,
      payload: summary
    };

    const result = await this.publishMessage(topic.topicId, message);
    
    await this.deactivateTopic(meetingId);
    
    return result;
  }

  async publishHeartbeat(meetingId: string): Promise<HCSSubmissionResult> {
    const identity = await this.identityManager.getIdentity();
    if (!identity) {
      throw new Error('Agent identity not found');
    }

    const topic = await this.getOrCreateTopicForMeeting(meetingId);
    
    const message: HCSMessage = {
      type: 'heartbeat',
      timestamp: Date.now(),
      meetingId,
      agentId: identity.accountId,
      payload: {
        status: 'active',
        lastActivity: Date.now()
      }
    };

    return await this.publishMessage(topic.topicId, message);
  }

  async getTopicMessages(topicId: string, limit: number = 10): Promise<HCSMessage[]> {
    try {
      const identity = await this.identityManager.getIdentity();
      if (!identity) {
        throw new Error('Agent identity not found');
      }

      const mirrorUrl = 'https://testnet.mirrornode.hedera.com';
      const response = await fetch(`${mirrorUrl}/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`);
      const data = await response.json();
      
      return data.messages?.map((msg: any) => {
        try {
          const messageText = Buffer.from(msg.message, 'base64').toString('utf8');
          return JSON.parse(messageText) as HCSMessage;
        } catch (error) {
          console.warn('Failed to parse HCS message:', error);
          return {
            type: 'transcription',
            timestamp: Date.now(),
            meetingId: '',
            agentId: '',
            payload: { text: msg.message, error: 'parse_failed' }
          };
        }
      }) || [];
    } catch (error) {
      console.error('Failed to get topic messages:', error);
      return [];
    }
  }

  private async updateTopicMessageCount(meetingId: string): Promise<void> {
    const topic = await StorageService.getHCSTopic(meetingId);
    if (topic) {
      topic.messageCount += 1;
      topic.lastMessageTimestamp = Date.now();
      await StorageService.saveHCSTopic(topic);
    }
  }

  private async deactivateTopic(meetingId: string): Promise<void> {
    const topic = await StorageService.getHCSTopic(meetingId);
    if (topic) {
      topic.isActive = false;
      await StorageService.saveHCSTopic(topic);
    }
  }

  async getActiveTopics(): Promise<HCSTopic[]> {
    const sessions = await StorageService.getAllMeetingSessions();
    const activeTopics: HCSTopic[] = [];
    
    for (const session of sessions) {
      if (session.status !== 'completed') {
        const topic = await StorageService.getHCSTopic(session.meetingInfo.meetingId);
        if (topic && topic.isActive) {
          activeTopics.push(topic);
        }
      }
    }
    
    return activeTopics;
  }
}