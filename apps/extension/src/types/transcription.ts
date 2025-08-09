export interface TranscriptionSegment {
  segmentId: string;
  sessionId: string;
  sequence: number;
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  text: string;
  confidence: number;
  status: 'processing' | 'completed' | 'error';
  timestamp: number;
  isFinal: boolean;
  wordCount?: number;
  error?: string;
  agentProcessed?: boolean;
  agentError?: string;
}

export interface TranscriptionSession {
  sessionId: string;
  meetingSessionId: string;
  hcsTopicId: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  startTime: number;
  endTime: number | null;
  totalSegments: number;
  totalWords: number;
  language: string;
  segments: TranscriptionSegment[];
  recordingDuration: number;
  meetingId: string;
  processedSegmentIds: string[];
  queuedSegmentCount: number;
  error?: string;
}

export interface TranscriptionConfig {
  segmentDurationMs: number;
  maxRetries: number;
  retryDelayMs: number;
  transcriptionEndpoint: string;
  language: string;
}

export interface AgentToolCall {
  toolName: string;
  parameters: Record<string, any>;
  expectedResponse: string;
}

export interface TranscriptionResult {
  success: boolean;
  transcription?: {
    text: string;
    confidence: number;
    segments?: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
  error?: string;
}

export interface MeetingSummary {
  text: string;
  actionItems: string[];
  keyPoints: string[];
  participants?: string[];
  duration: number;
  wordCount: number;
}