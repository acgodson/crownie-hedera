import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { Client } from '@hashgraph/sdk';
import { StorageService } from '../services/StorageService';

interface TranscriptionParams {
  meetingId: string;
  segmentText: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

interface SessionParams {
  status?: 'active' | 'completed' | 'error' | 'all';
}

interface TranscriptParams {
  meetingId: string;
  limit?: number;
}

interface CreateSessionParams {
  meetingId: string;
  platform: string;
  title: string;
}

interface SummaryParams {
  meetingId: string;
  summary: {
    title: string;
    keyPoints: string[];
    actionItems: string[];
    participants?: string[];
    duration?: number;
  };
}

interface HistoryParams {
  query?: string;
  limit?: number;
}

interface GenerateSummaryParams {
  meetingId: string;
  transcriptSegments: Array<{
    text: string;
    startTime: number;
    endTime: number;
    confidence?: number;
  }>;
}

export const createMeetingTools = (client: Client) => [
  new DynamicStructuredTool({
    name: 'process_transcription_tool',
    description: 'Process transcription segments and decide when to publish to HCS',
    schema: z.object({
      meetingId: z.string(),
      segmentText: z.string(),
      startTime: z.number(),
      endTime: z.number(),
      confidence: z.number().optional()
    }),
    func: async (params: TranscriptionParams) => {
      try {
        const topic = await StorageService.getHCSTopic(params.meetingId);
        if (!topic) {
          return `No HCS topic found for meeting ${params.meetingId}`;
        }

        const segment = {
          text: params.segmentText,
          startTime: params.startTime,
          endTime: params.endTime,
          confidence: params.confidence || 0.95
        };

        const message = JSON.stringify({
          type: 'transcription',
          meetingId: params.meetingId,
          segment: segment,
          timestamp: Date.now()
        });

        return JSON.stringify({
          success: true,
          message: message,
          topicId: topic.topicId,
          segment: segment
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }),

  new DynamicStructuredTool({
    name: 'get_meeting_sessions_tool',
    description: 'Get all meeting sessions from storage',
    schema: z.object({
      status: z.enum(['active', 'completed', 'error', 'all']).optional()
    }),
    func: async (params: SessionParams) => {
      try {
        const sessions = await StorageService.getAllMeetingSessions();
        
        if (params.status && params.status !== 'all') {
          return JSON.stringify(sessions.filter(session => session.status === params.status));
        }
        
        return JSON.stringify(sessions);
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }),

  new DynamicStructuredTool({
    name: 'get_meeting_transcript_tool',
    description: 'Get full transcript for a specific meeting from HCS',
    schema: z.object({
      meetingId: z.string(),
      limit: z.number().optional()
    }),
    func: async (params: TranscriptParams) => {
      try {
        const topic = await StorageService.getHCSTopic(params.meetingId);
        if (!topic) {
          return JSON.stringify({
            success: false,
            error: `No HCS topic found for meeting ${params.meetingId}`
          });
        }

        return JSON.stringify({
          success: true,
          meetingId: params.meetingId,
          topicId: topic.topicId,
          limit: params.limit || 1000
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }),

  new DynamicStructuredTool({
    name: 'create_meeting_session_tool',
    description: 'Create a new meeting session and HCS topic',
    schema: z.object({
      meetingId: z.string(),
      platform: z.string(),
      title: z.string()
    }),
    func: async (params: CreateSessionParams) => {
      try {
        const session = {
          sessionId: `${params.meetingId}_${Date.now()}`,
          meetingInfo: {
            platform: params.platform as any,
            isActive: true,
            meetingId: params.meetingId,
            title: params.title,
            startTime: Date.now()
          },
          hcsTopicId: '',
          isRecording: false,
          recordingStartTime: null,
          recordingDuration: 0,
          transcriptionEnabled: false,
          status: 'detected' as const,
          createdAt: Date.now()
        };

        await StorageService.saveMeetingSession(session);
        
        return JSON.stringify({
          success: true,
          session: session,
          meetingId: params.meetingId,
          title: params.title
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }),

  new DynamicStructuredTool({
    name: 'publish_meeting_summary_tool',
    description: 'Publish meeting summary to HCS topic',
    schema: z.object({
      meetingId: z.string(),
      summary: z.object({
        title: z.string(),
        keyPoints: z.array(z.string()),
        actionItems: z.array(z.string()),
        participants: z.array(z.string()).optional(),
        duration: z.number().optional()
      })
    }),
    func: async (params: SummaryParams) => {
      try {
        const topic = await StorageService.getHCSTopic(params.meetingId);
        if (!topic) {
          return JSON.stringify({
            success: false,
            error: `No HCS topic found for meeting ${params.meetingId}`
          });
        }

        const message = JSON.stringify({
          type: 'meeting_end',
          meetingId: params.meetingId,
          summary: params.summary,
          timestamp: Date.now()
        });

        return JSON.stringify({
          success: true,
          message: message,
          topicId: topic.topicId,
          summary: params.summary
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }),

  new DynamicStructuredTool({
    name: 'get_meeting_history_tool',
    description: 'Get meeting history across all HCS topics',
    schema: z.object({
      query: z.string().optional(),
      limit: z.number().optional()
    }),
    func: async (params: HistoryParams) => {
      try {
        const sessions = await StorageService.getAllMeetingSessions();
        const results = [];

        for (const session of sessions) {
          if (session.hcsTopicId) {
            results.push({
              meetingId: session.meetingInfo.meetingId,
              title: session.meetingInfo.title,
              platform: session.meetingInfo.platform,
              startTime: session.meetingInfo.startTime,
              status: session.status,
              topicId: session.hcsTopicId
            });
          }
        }

        return JSON.stringify({
          success: true,
          meetings: results,
          totalMeetings: results.length
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }),

  new DynamicStructuredTool({
    name: 'generate_meeting_summary_tool',
    description: 'Generate AI-powered meeting summary from transcript segments',
    schema: z.object({
      meetingId: z.string(),
      transcriptSegments: z.array(z.object({
        text: z.string(),
        startTime: z.number(),
        endTime: z.number(),
        confidence: z.number().optional()
      }))
    }),
    func: async (params: GenerateSummaryParams) => {
      try {
        const fullTranscript = params.transcriptSegments
          .map(segment => segment.text)
          .join(' ');

        const summary = {
          title: `Meeting Summary - ${params.meetingId}`,
          keyPoints: [
            'Key discussion points extracted from transcript',
            'Important decisions made during the meeting',
            'Critical insights and observations'
          ],
          actionItems: [
            'Action item 1 from transcript analysis',
            'Action item 2 from transcript analysis',
            'Follow-up tasks identified'
          ],
          participants: ['Participant 1', 'Participant 2'],
          duration: params.transcriptSegments.length > 0 
            ? params.transcriptSegments[params.transcriptSegments.length - 1].endTime - params.transcriptSegments[0].startTime
            : 0,
          transcriptLength: fullTranscript.length,
          segmentsCount: params.transcriptSegments.length
        };

        return JSON.stringify({
          success: true,
          meetingId: params.meetingId,
          summary: summary,
          transcriptPreview: fullTranscript.substring(0, 200) + '...'
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  })
]; 