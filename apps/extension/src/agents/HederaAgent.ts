import type { 
  AgentState, 
  AgentConfig, 
  AgentCapabilities,
  MeetingSession,
  TranscriptionChunk,
  MeetingSummary
} from '../types';
import { IdentityManager } from './IdentityManager';
import { HCSService } from '../services/HCSService';
import { StorageService } from '../services/StorageService';

export class HederaAgent {
  private identityManager: IdentityManager;
  private hcsService: HCSService;
  private state: AgentState;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.identityManager = new IdentityManager();
    this.hcsService = new HCSService(this.identityManager);
    
    this.state = {
      status: 'initializing',
      identity: null,
      capabilities: this.getDefaultCapabilities(),
      config: this.getDefaultConfig()
    };
  }

  async initialize(config?: Partial<AgentConfig>): Promise<AgentState> {
    try {
      this.state.status = 'initializing';
      
      if (config) {
        this.state.config = { ...this.state.config, ...config };
        await StorageService.saveAgentConfig(this.state.config);
      }

      this.state.identity = await this.identityManager.initialize(this.state.config);
      
      const isHealthy = await this.identityManager.isHealthy();
      
      if (!isHealthy) {
        this.state.status = 'error';
        this.state.errorMessage = 'Agent identity is not healthy - insufficient balance or network issues';
        return this.state;
      }

      this.state.status = 'active';
      this.state.lastHeartbeat = Date.now();
      
      this.startHeartbeat();
      await StorageService.updateLastHeartbeat();
      
      return this.state;
    } catch (error) {
      this.state.status = 'error';
      this.state.errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      console.error('Failed to initialize Hedera agent:', error);
      return this.state;
    }
  }

  async importAccount(privateKeyString: string, accountId: string, network: 'testnet' | 'mainnet' = 'testnet'): Promise<AgentState> {
    try {
      this.state.status = 'initializing';
      
      this.state.identity = await this.identityManager.importWithAccountId(privateKeyString, accountId, network);
      
      const isHealthy = await this.identityManager.isHealthy();
      
      if (!isHealthy) {
        this.state.status = 'error';
        this.state.errorMessage = 'Imported account is not healthy';
        return this.state;
      }

      this.state.status = 'active';
      this.state.lastHeartbeat = Date.now();
      
      this.startHeartbeat();
      await StorageService.updateLastHeartbeat();
      
      return this.state;
    } catch (error) {
      this.state.status = 'error';
      this.state.errorMessage = error instanceof Error ? error.message : 'Failed to import account';
      console.error('Failed to import account:', error);
      return this.state;
    }
  }

  async startMeetingSession(meetingId: string, platform: string, title: string): Promise<MeetingSession> {
    if (this.state.status !== 'active') {
      throw new Error('Agent is not active');
    }

    const sessionId = `${meetingId}_${Date.now()}`;
    
    const session: MeetingSession = {
      sessionId,
      meetingInfo: {
        platform: platform as any,
        isActive: true,
        meetingId,
        title,
        startTime: Date.now()
      },
      hcsTopicId: '',
      isRecording: false,
      recordingStartTime: null,
      recordingDuration: 0,
      transcriptionEnabled: false,
      status: 'detected',
      createdAt: Date.now()
    };

    try {
      const topic = await this.hcsService.createTopicForMeeting(meetingId);
      session.hcsTopicId = topic.topicId;
      
      await this.hcsService.publishMeetingStart(meetingId, title);
      
      await StorageService.saveMeetingSession(session);
      
      return session;
    } catch (error) {
      session.status = 'error';
      await StorageService.saveMeetingSession(session);
      throw error;
    }
  }

  async startRecording(sessionId: string): Promise<void> {
    const session = await StorageService.getMeetingSession(sessionId);
    if (!session) {
      throw new Error('Meeting session not found');
    }

    session.isRecording = true;
    session.recordingStartTime = Date.now();
    session.status = 'recording';
    
    await StorageService.saveMeetingSession(session);
  }

  async stopRecording(sessionId: string): Promise<void> {
    const session = await StorageService.getMeetingSession(sessionId);
    if (!session) {
      throw new Error('Meeting session not found');
    }

    session.isRecording = false;
    session.recordingDuration = session.recordingStartTime 
      ? Date.now() - session.recordingStartTime 
      : 0;
    session.status = 'completed';
    
    await StorageService.saveMeetingSession(session);
  }

  async enableTranscription(sessionId: string): Promise<void> {
    const session = await StorageService.getMeetingSession(sessionId);
    if (!session) {
      throw new Error('Meeting session not found');
    }

    session.transcriptionEnabled = true;
    session.status = 'transcribing';
    
    await StorageService.saveMeetingSession(session);
  }

  async publishTranscriptionChunk(
    sessionId: string, 
    chunk: TranscriptionChunk
  ): Promise<void> {
    const session = await StorageService.getMeetingSession(sessionId);
    if (!session) {
      throw new Error('Meeting session not found');
    }

    if (!session.transcriptionEnabled) {
      throw new Error('Transcription not enabled for this session');
    }

    await this.hcsService.publishTranscriptionChunk(
      session.meetingInfo.meetingId,
      chunk
    );
  }

  async endMeetingSession(sessionId: string, summary?: MeetingSummary): Promise<void> {
    const session = await StorageService.getMeetingSession(sessionId);
    if (!session) {
      throw new Error('Meeting session not found');
    }

    session.status = 'completed';
    session.endedAt = Date.now();
    
    if (summary) {
      await this.hcsService.publishMeetingEnd(
        session.meetingInfo.meetingId,
        summary
      );
    }
    
    await StorageService.saveMeetingSession(session);
  }

  async getActiveSessions(): Promise<MeetingSession[]> {
    const sessions = await StorageService.getAllMeetingSessions();
    return sessions.filter(session => 
      session.status !== 'completed' && session.status !== 'error'
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (this.state.status === 'error') {
        return false;
      }

      const isHealthy = await this.identityManager.isHealthy();
      
      if (!isHealthy) {
        this.state.status = 'error';
        this.state.errorMessage = 'Health check failed - agent identity issues';
      }

      return isHealthy;
    } catch (error) {
      this.state.status = 'error';
      this.state.errorMessage = 'Health check exception';
      return false;
    }
  }

  getState(): AgentState {
    return { ...this.state };
  }

  async getAccountBalance(): Promise<number> {
    return await this.identityManager.getAccountBalance();
  }

  private getDefaultCapabilities(): AgentCapabilities {
    return {
      canTranscribe: true,
      canPublishToHCS: true,
      canDetectMeetings: true,
      canProcessAudio: true
    };
  }

  private getDefaultConfig(): AgentConfig {
    return {
      network: 'testnet',
      maxTranscriptionChunkSize: 1000,
      transcriptionInterval: 5000,
      heartbeatInterval: 30000
    };
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      try {
        this.state.lastHeartbeat = Date.now();
        await StorageService.updateLastHeartbeat();
        
        const activeSessions = await this.getActiveSessions();
        for (const session of activeSessions) {
          await this.hcsService.publishHeartbeat(session.meetingInfo.meetingId);
        }
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, this.state.config.heartbeatInterval) as NodeJS.Timeout;
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    const activeSessions = await this.getActiveSessions();
    for (const session of activeSessions) {
      await this.endMeetingSession(session.sessionId);
    }

    this.state.status = 'idle';
  }
}