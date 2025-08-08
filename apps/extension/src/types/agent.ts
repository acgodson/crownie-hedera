export interface AgentIdentity {
  accountId: string;
  publicKey: string;
  privateKey?: string;
  isInitialized: boolean;
  createdAt: number;
  lastActiveAt: number;
}

export interface AgentCapabilities {
  canTranscribe: boolean;
  canPublishToHCS: boolean;
  canDetectMeetings: boolean;
  canProcessAudio: boolean;
}

export interface AgentConfig {
  network: 'testnet' | 'mainnet';
  hcsTopicId?: string;
  maxTranscriptionChunkSize: number;
  transcriptionInterval: number;
  heartbeatInterval: number;
}

export interface AgentState {
  status: 'initializing' | 'active' | 'idle' | 'error';
  identity: AgentIdentity | null;
  capabilities: AgentCapabilities;
  config: AgentConfig;
  errorMessage?: string;
  lastHeartbeat?: number;
}

export interface HCSMessage {
  type: 'transcription' | 'meeting_start' | 'meeting_end' | 'heartbeat' | 'action_item';
  timestamp: number;
  meetingId: string;
  agentId: string;
  payload: any;
  sequenceNumber?: number;
}

export interface TranscriptionChunk {
  text: string;
  timestamp: number;
  confidence: number;
  speaker?: string;
  chunkId: string;
}

export interface MeetingSummary {
  meetingId: string;
  platform: string;
  title: string;
  startTime: number;
  endTime: number;
  participants: string[];
  transcript: TranscriptionChunk[];
  actionItems: ActionItem[];
  summary: string;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  dueDate?: number;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
}