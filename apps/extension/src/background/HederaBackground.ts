import browser from "webextension-polyfill";
import { HederaAgent } from '../agents/HederaAgent';
import { StorageService } from '../services/StorageService';
import type { MeetingSession, AgentConfig } from '../types';

class CrownieHederaBackground {
  private hederaAgent: HederaAgent;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    this.hederaAgent = new HederaAgent();
    this.setupMessageListener(); 
    this.setupKeepalive();
    this.initializeAgent();
  }

  private async initializeAgent(): Promise<void> {
    try {
      const config: Partial<AgentConfig> = {
        network: 'testnet',
        maxTranscriptionChunkSize: 1000,
        transcriptionInterval: 5000,
        heartbeatInterval: 30000
      };

      await this.hederaAgent.initialize(config);
      this.isInitialized = true;
      console.log('✅ Hedera Agent initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Hedera Agent:', error);
      this.isInitialized = false;
    }
  }

  private setupMessageListener() {
    browser.runtime.onMessage.addListener(async (message: any, sender: any) => {
      try {
        switch (message?.action) {
          case "MEETING_DETECTED":
            return await this.handleMeetingDetected(message.data);
          case "GET_MEETING_STATUS":
            return await this.getMeetingStatus();
          case "START_RECORDING":
            return await this.startRecording(message.sessionId);
          case "STOP_RECORDING":
            return await this.stopRecording(message.sessionId);
          case "START_TRADE":
            return await this.handleStartTrade(message.data);
          case "STOP_TRADE":
            return await this.handleStopTrade();
          case "HEALTH_CHECK":
            return await this.healthCheck();
          case "GET_AGENT_STATE":
            return await this.getAgentState();
          case "GET_ACCOUNT_BALANCE":
            return await this.getAccountBalance();
          case "SAVE_MEETING_SECRET":
            return await this.saveMeetingSecret(message.data);
          case "GET_MEETING_SECRET":
            return await this.getMeetingSecret(message.data);
          case "OPEN_POPUP":
            return await this.openPopup();
          default:
            return { error: `Unknown action: ${message?.action}` };
        }
      } catch (error) {
        console.error('❌ Background: Message handler error:', error);
        return { 
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false 
        };
      }
    });
  }

  private setupKeepalive(): void {
    this.keepAliveInterval = setInterval(() => {
    }, 20000) as NodeJS.Timeout;
    
    self.addEventListener('beforeunload', () => {
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
      }
    });
  }

  private async handleMeetingDetected(data: any): Promise<any> {
    try {
      if (!this.isInitialized) {
        throw new Error('Agent not initialized');
      }

      const session = await this.hederaAgent.startMeetingSession(
        data.meetingId,
        data.platform,
        data.title
      );

      return { 
        success: true, 
        sessionId: session.sessionId,
        hcsTopicId: session.hcsTopicId
      };
    } catch (error) {
      console.error('❌ Background: Failed to handle meeting detection:', error);
      throw error;
    }
  }

  private async getMeetingStatus(): Promise<any> {
    try {
      const activeSessions = await this.hederaAgent.getActiveSessions();
      const latestSession = activeSessions[activeSessions.length - 1];

      if (!latestSession) {
        return {
          isMeetingDetected: false,
          isRecording: false,
          recordingDuration: 0
        };
      }

      return {
        isMeetingDetected: true,
        platform: latestSession.meetingInfo.platform,
        meetingId: latestSession.meetingInfo.meetingId,
        title: latestSession.meetingInfo.title,
        isRecording: latestSession.isRecording,
        recordingDuration: latestSession.recordingDuration,
        sessionId: latestSession.sessionId,
        hcsTopicId: latestSession.hcsTopicId
      };
    } catch (error) {
      console.error('❌ Background: Failed to get meeting status:', error);
      return {
        isMeetingDetected: false,
        isRecording: false,
        recordingDuration: 0
      };
    }
  }

  private async startRecording(sessionId?: string): Promise<any> {
    try {
      if (!sessionId) {
        const activeSessions = await this.hederaAgent.getActiveSessions();
        const latestSession = activeSessions[activeSessions.length - 1];
        if (!latestSession) {
          throw new Error('No active session found');
        }
        sessionId = latestSession.sessionId;
      }

      await this.hederaAgent.startRecording(sessionId);
      await this.hederaAgent.enableTranscription(sessionId);

      return { success: true, message: 'Recording started' };
    } catch (error) {
      console.error('❌ Background: Failed to start recording:', error);
      throw error;
    }
  }

  private async stopRecording(sessionId?: string): Promise<any> {
    try {
      if (!sessionId) {
        const activeSessions = await this.hederaAgent.getActiveSessions();
        const recordingSession = activeSessions.find(s => s.isRecording);
        if (!recordingSession) {
          throw new Error('No recording session found');
        }
        sessionId = recordingSession.sessionId;
      }

      await this.hederaAgent.stopRecording(sessionId);

      return { success: true, message: 'Recording stopped' };
    } catch (error) {
      console.error('❌ Background: Failed to stop recording:', error);
      throw error;
    }
  }

  private async handleStartTrade(data: any): Promise<any> {
    try {
      const baseUrl = process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : 'https://crownie-swap.vercel.app';
      
      const swapUrl = `${baseUrl}/create-order?secretHash=${data.hashLock}&meetingId=${data.meetingId}`;
      
      const tab = await browser.tabs.create({
        url: swapUrl,
        active: true
      });
      
      return { 
        success: true, 
        message: 'Trade started',
        swapUrl,
        tabId: tab.id
      };
    } catch (error) {
      console.error('❌ Background: Failed to start trade:', error);
      throw error;
    }
  }

  private async handleStopTrade(): Promise<any> {
    try {
      const tabs = await browser.tabs.query({
        url: '*://crownie-swap.vercel.app/*'
      });
      
      for (const tab of tabs) {
        if (tab.id) {
          await browser.tabs.remove(tab.id);
        }
      }
      
      return { success: true, message: 'Trade stopped' };
    } catch (error) {
      console.error('❌ Background: Failed to stop trade:', error);
      throw error;
    }
  }

  private async healthCheck(): Promise<any> {
    try {
      const isHealthy = await this.hederaAgent.healthCheck();
      const state = this.hederaAgent.getState();
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        agent: state.status,
        network: state.config.network,
        timestamp: Date.now(),
        accountId: state.identity?.accountId,
        balance: state.identity ? await this.hederaAgent.getAccountBalance() : 0
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  private async getAgentState(): Promise<any> {
    return this.hederaAgent.getState();
  }

  private async getAccountBalance(): Promise<any> {
    try {
      const balance = await this.hederaAgent.getAccountBalance();
      return {
        balance: balance.toString(),
        formatted: (balance / 100000000).toFixed(8) + ' HBAR'
      };
    } catch (error) {
      throw error;
    }
  }

  private async saveMeetingSecret(data: { meetingId: string; secret: string; hashLock: string }): Promise<any> {
    try {
      await StorageService.saveMeetingSecret(data.meetingId, data.secret);
      return { success: true, secret: data.secret };
    } catch (error) {
      console.error('❌ Background: Failed to save meeting secret:', error);
      throw error;
    }
  }

  private async getMeetingSecret(data: { meetingId: string }): Promise<any> {
    try {
      const secret = await StorageService.getMeetingSecret(data.meetingId);
      
      if (secret) {
        return { success: true, secret };
      } else {
        return { success: false, error: 'No secret found' };
      }
    } catch (error) {
      console.error('❌ Background: Failed to get meeting secret:', error);
      throw error;
    }
  }

  private async openPopup(): Promise<any> {
    try {
      await browser.action.openPopup();
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Could not open popup' };
    }
  }
}

try {
  new CrownieHederaBackground();
} catch (error) {
  console.error('❌ Background: Failed to initialize Crownie Hedera Background:', error);
}

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log('🚀 Crownie Hedera Extension installed');
  }
});