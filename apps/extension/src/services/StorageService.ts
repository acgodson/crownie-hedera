import type {
  AgentIdentity,
  AgentConfig,
  MeetingSession,
  HCSTopic,
  TranscriptionSession,
} from "../types";

export class StorageService {
  private static readonly STORAGE_KEYS = {
    AGENT_IDENTITY: "agent_identity",
    AGENT_CONFIG: "agent_config",
    MEETING_SESSIONS: "meeting_sessions",
    TRANSCRIPTION_SESSIONS: "transcription_sessions",
    HCS_TOPICS: "hcs_topics",
    MEETING_SECRETS: "meeting_secrets",
    MEETING_TOPICS: "meeting_topics",
    LAST_HEARTBEAT: "last_heartbeat",
    AGENT_STATE: "agent_state",
    OPENAI_API_KEY: "openaiApiKey",
    ONBOARDING_COMPLETED: "onboarding_completed",
  } as const;

  static async getAgentIdentity(): Promise<AgentIdentity | null> {
    const result = await chrome.storage.local.get(
      this.STORAGE_KEYS.AGENT_IDENTITY
    );
    return result[this.STORAGE_KEYS.AGENT_IDENTITY] || null;
  }

  static async saveAgentIdentity(identity: AgentIdentity): Promise<void> {
    await chrome.storage.local.set({
      [this.STORAGE_KEYS.AGENT_IDENTITY]: identity,
    });
  }

  static async getAgentConfig(): Promise<AgentConfig | null> {
    const result = await chrome.storage.local.get(
      this.STORAGE_KEYS.AGENT_CONFIG
    );
    return result[this.STORAGE_KEYS.AGENT_CONFIG] || null;
  }

  static async saveAgentConfig(config: AgentConfig): Promise<void> {
    await chrome.storage.local.set({
      [this.STORAGE_KEYS.AGENT_CONFIG]: config,
    });
  }

  static async getMeetingSession(
    sessionId: string
  ): Promise<MeetingSession | null> {
    const result = await chrome.storage.local.get(
      this.STORAGE_KEYS.MEETING_SESSIONS
    );
    const sessions = result[this.STORAGE_KEYS.MEETING_SESSIONS] || {};
    return sessions[sessionId] || null;
  }

  static async saveMeetingSession(session: MeetingSession): Promise<void> {
    const result = await chrome.storage.local.get(
      this.STORAGE_KEYS.MEETING_SESSIONS
    );
    const sessions = result[this.STORAGE_KEYS.MEETING_SESSIONS] || {};
    sessions[session.sessionId] = session;

    await chrome.storage.local.set({
      [this.STORAGE_KEYS.MEETING_SESSIONS]: sessions,
    });
  }

  static async getAllMeetingSessions(): Promise<MeetingSession[]> {
    const result = await chrome.storage.local.get(
      this.STORAGE_KEYS.MEETING_SESSIONS
    );
    const sessions = result[this.STORAGE_KEYS.MEETING_SESSIONS] || {};
    return Object.values(sessions);
  }

  static async deleteMeetingSession(sessionId: string): Promise<void> {
    const result = await chrome.storage.local.get(
      this.STORAGE_KEYS.MEETING_SESSIONS
    );
    const sessions = result[this.STORAGE_KEYS.MEETING_SESSIONS] || {};
    delete sessions[sessionId];

    await chrome.storage.local.set({
      [this.STORAGE_KEYS.MEETING_SESSIONS]: sessions,
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
      [this.STORAGE_KEYS.HCS_TOPICS]: topics,
    });
  }

  static async getMeetingSecret(meetingId: string): Promise<string | null> {
    const result = await chrome.storage.local.get(
      `${this.STORAGE_KEYS.MEETING_SECRETS}_${meetingId}`
    );
    return result[`${this.STORAGE_KEYS.MEETING_SECRETS}_${meetingId}`] || null;
  }

  static async saveMeetingSecret(
    meetingId: string,
    secret: string
  ): Promise<void> {
    await chrome.storage.local.set({
      [`${this.STORAGE_KEYS.MEETING_SECRETS}_${meetingId}`]: secret,
    });
  }

  static async updateLastHeartbeat(): Promise<void> {
    await chrome.storage.local.set({
      [this.STORAGE_KEYS.LAST_HEARTBEAT]: Date.now(),
    });
  }

  static async getLastHeartbeat(): Promise<number | null> {
    const result = await chrome.storage.local.get(
      this.STORAGE_KEYS.LAST_HEARTBEAT
    );
    return result[this.STORAGE_KEYS.LAST_HEARTBEAT] || null;
  }

  static async clearAgentData(): Promise<void> {
    const keys = Object.values(this.STORAGE_KEYS);
    await chrome.storage.local.remove(keys);

    const allData = await chrome.storage.local.get();
    const secretKeys = Object.keys(allData).filter((key) =>
      key.startsWith(this.STORAGE_KEYS.MEETING_SECRETS)
    );
    if (secretKeys.length > 0) {
      await chrome.storage.local.remove(secretKeys);
    }
  }

  static async saveTranscriptionSession(
    session: TranscriptionSession
  ): Promise<void> {
    const sessions = await this.getAllTranscriptionSessions();
    const existingIndex = sessions.findIndex(
      (s) => s.sessionId === session.sessionId
    );

    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }

    await chrome.storage.local.set({
      [this.STORAGE_KEYS.TRANSCRIPTION_SESSIONS]: sessions,
    });
  }

  static async getTranscriptionSession(
    sessionId: string
  ): Promise<TranscriptionSession | null> {
    const sessions = await this.getAllTranscriptionSessions();
    return sessions.find((session) => session.sessionId === sessionId) || null;
  }

  static async getAllTranscriptionSessions(): Promise<TranscriptionSession[]> {
    const result = await chrome.storage.local.get(
      this.STORAGE_KEYS.TRANSCRIPTION_SESSIONS
    );
    return result[this.STORAGE_KEYS.TRANSCRIPTION_SESSIONS] || [];
  }

  static async deleteTranscriptionSession(sessionId: string): Promise<void> {
    const sessions = await this.getAllTranscriptionSessions();
    const filteredSessions = sessions.filter(
      (session) => session.sessionId !== sessionId
    );

    await chrome.storage.local.set({
      [this.STORAGE_KEYS.TRANSCRIPTION_SESSIONS]: filteredSessions,
    });
  }

  static async saveAgentState(state: any): Promise<void> {
    await chrome.storage.local.set({
      [this.STORAGE_KEYS.AGENT_STATE]: state,
    });
  }

  static async getAgentState(): Promise<any | null> {
    const result = await chrome.storage.local.get(
      this.STORAGE_KEYS.AGENT_STATE
    );
    return result[this.STORAGE_KEYS.AGENT_STATE] || null;
  }

  static async getOpenAIApiKey(): Promise<string | null> {
    const result = await chrome.storage.local.get(
      this.STORAGE_KEYS.OPENAI_API_KEY
    );
    return result[this.STORAGE_KEYS.OPENAI_API_KEY] || null;
  }

  static async saveOpenAIApiKey(apiKey: string): Promise<void> {
    await chrome.storage.local.set({
      [this.STORAGE_KEYS.OPENAI_API_KEY]: apiKey,
    });
  }

  static async isOnboardingCompleted(): Promise<boolean> {
    const result = await chrome.storage.local.get(
      this.STORAGE_KEYS.ONBOARDING_COMPLETED
    );
    return result[this.STORAGE_KEYS.ONBOARDING_COMPLETED] || false;
  }

  static async setOnboardingCompleted(
    completed: boolean = true
  ): Promise<void> {
    await chrome.storage.local.set({
      [this.STORAGE_KEYS.ONBOARDING_COMPLETED]: completed,
    });
  }

  static async saveMeetingTopic(
    meetingId: string,
    topicId: string
  ): Promise<void> {
    const topics = await this.getMeetingTopics();
    topics[meetingId] = topicId;

    await chrome.storage.local.set({
      [this.STORAGE_KEYS.MEETING_TOPICS]: topics,
    });
  }

  static async getMeetingTopic(meetingId: string): Promise<string | null> {
    const topics = await this.getMeetingTopics();
    return topics[meetingId] || null;
  }

  static async getMeetingTopics(): Promise<Record<string, string>> {
    const result = await chrome.storage.local.get(
      this.STORAGE_KEYS.MEETING_TOPICS
    );
    return result[this.STORAGE_KEYS.MEETING_TOPICS] || {};
  }

  static async clearMeetingTopic(meetingId: string): Promise<void> {
    const topics = await this.getMeetingTopics();
    delete topics[meetingId];

    await chrome.storage.local.set({
      [this.STORAGE_KEYS.MEETING_TOPICS]: topics,
    });
  }
}
