import type { AgentIdentity, AgentConfig, MeetingSession, HCSTopic } from '../types';

export class StorageService {
  private static readonly STORAGE_KEYS = {
    AGENT_IDENTITY: 'agent_identity',
    AGENT_CONFIG: 'agent_config', 
    MEETING_SESSIONS: 'meeting_sessions',
    HCS_TOPICS: 'hcs_topics',
    MEETING_SECRETS: 'meeting_secrets',
    LAST_HEARTBEAT: 'last_heartbeat'
  } as const;

  static async getAgentIdentity(): Promise<AgentIdentity | null> {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.AGENT_IDENTITY);
    return result[this.STORAGE_KEYS.AGENT_IDENTITY] || null;
  }

  static async saveAgentIdentity(identity: AgentIdentity): Promise<void> {
    await chrome.storage.local.set({
      [this.STORAGE_KEYS.AGENT_IDENTITY]: identity
    });
  }

  static async getAgentConfig(): Promise<AgentConfig | null> {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.AGENT_CONFIG);
    return result[this.STORAGE_KEYS.AGENT_CONFIG] || null;
  }

  static async saveAgentConfig(config: AgentConfig): Promise<void> {
    await chrome.storage.local.set({
      [this.STORAGE_KEYS.AGENT_CONFIG]: config
    });
  }

  static async getMeetingSession(sessionId: string): Promise<MeetingSession | null> {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.MEETING_SESSIONS);
    const sessions = result[this.STORAGE_KEYS.MEETING_SESSIONS] || {};
    return sessions[sessionId] || null;
  }

  static async saveMeetingSession(session: MeetingSession): Promise<void> {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.MEETING_SESSIONS);
    const sessions = result[this.STORAGE_KEYS.MEETING_SESSIONS] || {};
    sessions[session.sessionId] = session;
    
    await chrome.storage.local.set({
      [this.STORAGE_KEYS.MEETING_SESSIONS]: sessions
    });
  }

  static async getAllMeetingSessions(): Promise<MeetingSession[]> {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.MEETING_SESSIONS);
    const sessions = result[this.STORAGE_KEYS.MEETING_SESSIONS] || {};
    return Object.values(sessions);
  }

  static async deleteMeetingSession(sessionId: string): Promise<void> {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.MEETING_SESSIONS);
    const sessions = result[this.STORAGE_KEYS.MEETING_SESSIONS] || {};
    delete sessions[sessionId];
    
    await chrome.storage.local.set({
      [this.STORAGE_KEYS.MEETING_SESSIONS]: sessions
    });
  }

  static async getHCSTopic(meetingId: string): Promise<HCSTopic | null> {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.HCS_TOPICS);
    const topics = result[this.STORAGE_KEYS.HCS_TOPICS] || {};
    return topics[meetingId] || null;
  }

  static async saveHCSTopic(topic: HCSTopic): Promise<void> {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.HCS_TOPICS);
    const topics = result[this.STORAGE_KEYS.HCS_TOPICS] || {};
    topics[topic.meetingId] = topic;
    
    await chrome.storage.local.set({
      [this.STORAGE_KEYS.HCS_TOPICS]: topics
    });
  }

  static async getMeetingSecret(meetingId: string): Promise<string | null> {
    const result = await chrome.storage.local.get(`${this.STORAGE_KEYS.MEETING_SECRETS}_${meetingId}`);
    return result[`${this.STORAGE_KEYS.MEETING_SECRETS}_${meetingId}`] || null;
  }

  static async saveMeetingSecret(meetingId: string, secret: string): Promise<void> {
    await chrome.storage.local.set({
      [`${this.STORAGE_KEYS.MEETING_SECRETS}_${meetingId}`]: secret
    });
  }

  static async updateLastHeartbeat(): Promise<void> {
    await chrome.storage.local.set({
      [this.STORAGE_KEYS.LAST_HEARTBEAT]: Date.now()
    });
  }

  static async getLastHeartbeat(): Promise<number | null> {
    const result = await chrome.storage.local.get(this.STORAGE_KEYS.LAST_HEARTBEAT);
    return result[this.STORAGE_KEYS.LAST_HEARTBEAT] || null;
  }

  static async clearAgentData(): Promise<void> {
    const keys = Object.values(this.STORAGE_KEYS);
    await chrome.storage.local.remove(keys);
    
    const allData = await chrome.storage.local.get();
    const secretKeys = Object.keys(allData).filter(key => 
      key.startsWith(this.STORAGE_KEYS.MEETING_SECRETS)
    );
    if (secretKeys.length > 0) {
      await chrome.storage.local.remove(secretKeys);
    }
  }
}