export interface MeetingInfo {
  platform: MeetingPlatform;
  isActive: boolean;
  meetingId: string;
  title: string;
  url?: string;
  startTime?: number;
  participants?: string[];
}

export type MeetingPlatform = 
  | 'Google Meet'
  | 'Zoom' 
  | 'Microsoft Teams'
  | 'Cisco Webex'
  | 'Discord'
  | 'Unknown';

export interface MeetingSession {
  sessionId: string;
  meetingInfo: MeetingInfo;
  hcsTopicId: string;
  isRecording: boolean;
  recordingStartTime: number | null;
  recordingDuration: number;
  transcriptionEnabled: boolean;
  status: MeetingStatus;
  createdAt: number;
  endedAt?: number;
}

export type MeetingStatus = 
  | 'detected'
  | 'recording' 
  | 'transcribing'
  | 'summarizing'
  | 'completed'
  | 'error';

export interface MeetingControls {
  canStartRecording: boolean;
  canStopRecording: boolean;
  canToggleTranscription: boolean;
  canViewTranscript: boolean;
}

export interface MeetingDetectionConfig {
  enabledPlatforms: MeetingPlatform[];
  detectionInterval: number;
  autoStartRecording: boolean;
  autoStartTranscription: boolean;
}

export interface PlatformSelector {
  platform: MeetingPlatform;
  urlPattern: RegExp;
  meetingIdExtractor: (url: string) => string | null;
  titleExtractor: () => string;
  activeIndicators: string[];
}