import type { MeetingInfo, MeetingSession, MeetingPlatform, PlatformSelector } from '../types';
import { StorageService } from './StorageService';

export class MeetingService {
  private currentSession: MeetingSession | null = null;

  private readonly PLATFORM_SELECTORS: PlatformSelector[] = [
    {
      platform: 'Google Meet',
      urlPattern: /^https:\/\/meet\.google\.com\/[a-z\-0-9]+(?:\?.*)?$/i,
      meetingIdExtractor: (url: string) => {
        const match = url.match(/meet\.google\.com\/([a-z\-0-9]+)/i);
        return match ? match[1] : null;
      },
      titleExtractor: () => document.title || 'Google Meet',
      activeIndicators: [
        '[data-call-id]',
        '[data-meeting-id]',
        '.google-meet-button',
        '[aria-label*="microphone"]',
        '[aria-label*="camera"]',
        '[data-promo-anchor-id]',
        '[jsname]'
      ]
    },
    {
      platform: 'Zoom',
      urlPattern: /^https:\/\/.*\.zoom\.us\/.*/,
      meetingIdExtractor: (url: string) => {
        const confno = new URLSearchParams(window.location.search).get('confno');
        if (confno) return confno;
        const pathMatch = url.match(/\/j\/(\d+)/);
        return pathMatch ? pathMatch[1] : null;
      },
      titleExtractor: () => document.title || 'Zoom Meeting',
      activeIndicators: [
        '.meeting-app',
        '[title*="mute"]',
        '[title*="camera"]',
        '.ReactModal__Content',
        '[data-testid="participants-button"]'
      ]
    },
    {
      platform: 'Microsoft Teams',
      urlPattern: /^https:\/\/teams\.microsoft\.com\/.*/,
      meetingIdExtractor: (url: string) => {
        const threadId = new URLSearchParams(window.location.search).get('threadId');
        return threadId || `teams_${Date.now()}`;
      },
      titleExtractor: () => document.title || 'Microsoft Teams',
      activeIndicators: [
        '[data-tid="toggle-mute"]',
        '[data-tid="toggle-video"]',
        '.ts-calling-screen',
        '[data-tid="calling-join-button"]'
      ]
    },
    {
      platform: 'Cisco Webex',
      urlPattern: /^https:\/\/.*\.webex\.com\/.*/,
      meetingIdExtractor: (url: string) => {
        const match = url.match(/\/meet\/([^\/\?]+)/);
        return match ? match[1] : null;
      },
      titleExtractor: () => document.title || 'Cisco Webex',
      activeIndicators: [
        '[data-testid="mute-audio-button"]',
        '[data-testid="mute-video-button"]',
        '.meeting-controls'
      ]
    },
    {
      platform: 'Discord',
      urlPattern: /^https:\/\/discord\.com\/channels\/.*/,
      meetingIdExtractor: (url: string) => {
        const match = url.match(/\/channels\/(\d+)\/(\d+)/);
        return match ? `${match[1]}_${match[2]}` : null;
      },
      titleExtractor: () => document.title || 'Discord',
      activeIndicators: [
        '[aria-label*="Mute"]',
        '[aria-label*="Deafen"]',
        '.panels-3wFtMD'
      ]
    }
  ];

  detectMeeting(): MeetingInfo | null {
    const url = window.location.href;
    console.log('🔍 MeetingService: Detecting meeting for URL:', url);
    
    for (const selector of this.PLATFORM_SELECTORS) {
      console.log('🔍 MeetingService: Testing pattern for', selector.platform, ':', selector.urlPattern.test(url));
      
      if (selector.urlPattern.test(url)) {
        const meetingId = selector.meetingIdExtractor(url);
        console.log('🔍 MeetingService: Extracted meeting ID:', meetingId);
        
        if (meetingId) {
          const isActive = this.isMeetingActive(selector);
          console.log('🔍 MeetingService: Is meeting active:', isActive);
          
          const meetingInfo = {
            platform: selector.platform,
            isActive,
            meetingId,
            title: selector.titleExtractor(),
            url,
            startTime: Date.now(),
            participants: this.extractParticipants(selector.platform)
          };
          
          console.log('🔍 MeetingService: Detected meeting:', meetingInfo);
          return meetingInfo;
        }
      }
    }
    
    console.log('🔍 MeetingService: No meeting detected');
    return null;
  }

  private isMeetingActive(selector: PlatformSelector): boolean {
    return selector.activeIndicators.some(indicator => {
      try {
        return document.querySelector(indicator) !== null;
      } catch (error) {
        return false;
      }
    });
  }

  private extractParticipants(platform: MeetingPlatform): string[] {
    try {
      switch (platform) {
        case 'Google Meet':
          const meetParticipants = document.querySelectorAll('[data-participant-id]');
          return Array.from(meetParticipants).map((el, index) => `Participant ${index + 1}`);
          
        case 'Zoom':
          const zoomParticipants = document.querySelectorAll('[aria-label*="participant"]');
          return Array.from(zoomParticipants).map((el, index) => `Participant ${index + 1}`);
          
        case 'Microsoft Teams':
          const teamsParticipants = document.querySelectorAll('[data-tid*="participant"]');
          return Array.from(teamsParticipants).map((el, index) => `Participant ${index + 1}`);
          
        default:
          return ['You'];
      }
    } catch (error) {
      return ['You'];
    }
  }

  async createSession(meetingInfo: MeetingInfo, hcsTopicId: string): Promise<MeetingSession> {
    const sessionId = `${meetingInfo.meetingId}_${Date.now()}`;
    
    const session: MeetingSession = {
      sessionId,
      meetingInfo,
      hcsTopicId,
      isRecording: false,
      recordingStartTime: null,
      recordingDuration: 0,
      transcriptionEnabled: false,
      status: 'detected',
      createdAt: Date.now()
    };

    this.currentSession = session;
    await StorageService.saveMeetingSession(session);
    
    return session;
  }

  async updateSession(sessionId: string, updates: Partial<MeetingSession>): Promise<void> {
    const session = await StorageService.getMeetingSession(sessionId);
    if (session) {
      const updatedSession = { ...session, ...updates };
      await StorageService.saveMeetingSession(updatedSession);
      
      if (this.currentSession?.sessionId === sessionId) {
        this.currentSession = updatedSession;
      }
    }
  }

  async endSession(sessionId: string): Promise<void> {
    await this.updateSession(sessionId, {
      status: 'completed',
      endedAt: Date.now()
    });
    
    if (this.currentSession?.sessionId === sessionId) {
      this.currentSession = null;
    }
  }

  getCurrentSession(): MeetingSession | null {
    return this.currentSession;
  }

  async getAllSessions(): Promise<MeetingSession[]> {
    return await StorageService.getAllMeetingSessions();
  }

  async getActiveSessions(): Promise<MeetingSession[]> {
    const sessions = await this.getAllSessions();
    return sessions.filter(session => 
      session.status !== 'completed' && session.status !== 'error'
    );
  }

  async cleanupOldSessions(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    const sessions = await this.getAllSessions();
    const cutoffTime = Date.now() - olderThanMs;
    
    for (const session of sessions) {
      if (session.createdAt < cutoffTime && session.status === 'completed') {
        await StorageService.deleteMeetingSession(session.sessionId);
      }
    }
  }
}