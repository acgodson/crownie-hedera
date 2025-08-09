import type { 
  TranscriptionSegment, 
  TranscriptionSession, 
  TranscriptionConfig, 
  TranscriptionResult,
  MeetingSummary 
} from '../types/transcription';
import { StorageService } from './StorageService';

interface QueuedSegment {
  segmentId: string;
  sessionId: string;
  audioData: string;
  startTimeMs: number;
  endTimeMs: number;
  sequence: number;
  attempts: number;
  hederaAgent?: any;
  hcsTopicId?: string;
}

export class TranscriptionService {
  private config: TranscriptionConfig;
  private activeSession: TranscriptionSession | null = null;
  private retryAttempts = new Map<string, number>();
  private processingQueue: QueuedSegment[] = [];
  private isProcessing = false;
  private processedSegments = new Set<string>();

  constructor(config?: Partial<TranscriptionConfig>) {
    this.config = {
      segmentDurationMs: 15000,
      maxRetries: 3,
      retryDelayMs: 1000,
      transcriptionEndpoint: 'https://us-central1-crownie-7c88e.cloudfunctions.net/proxy',
      language: 'en-US',
      ...config
    };
  }

  async startSession(
    meetingSessionId: string,
    hcsTopicId: string,
    meetingId: string
  ): Promise<TranscriptionSession> {
    const sessionId = `transcription_${meetingSessionId}_${Date.now()}`;
    
    const session: TranscriptionSession = {
      sessionId,
      meetingSessionId,
      hcsTopicId,
      status: 'active',
      startTime: Date.now(),
      endTime: null,
      totalSegments: 0,
      totalWords: 0,
      language: this.config.language,
      segments: [],
      recordingDuration: 0,
      meetingId,
      processedSegmentIds: [],
      queuedSegmentCount: 0
    };

    this.activeSession = session;
    session.processedSegmentIds.forEach(id => this.processedSegments.add(id));
    await StorageService.saveTranscriptionSession(session);
    
    return session;
  }

  async processAudioSegment(
    sessionId: string,
    audioData: string,
    startTimeMs: number,
    endTimeMs: number,
    sequence: number
  ): Promise<TranscriptionSegment> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('No active transcription session found');
    }

    const segmentId = `${sessionId}_${sequence}`;
    
    if (this.processedSegments.has(segmentId)) {
      console.log(`Segment ${segmentId} already processed, skipping`);
      const existingSegment = session.segments.find(s => s.segmentId === segmentId);
      if (existingSegment) {
        return existingSegment;
      }
    }
    
    const segment: TranscriptionSegment = {
      segmentId,
      sessionId,
      sequence,
      startTimeMs,
      endTimeMs,
      durationMs: endTimeMs - startTimeMs,
      text: '',
      confidence: 0,
      status: 'processing',
      timestamp: Date.now(),
      isFinal: false
    };

    session.segments.push(segment);
    await this.updateSession(session);

    const queuedSegment: QueuedSegment = {
      segmentId,
      sessionId,
      audioData,
      startTimeMs,
      endTimeMs,
      sequence,
      attempts: 0
    };

    this.processingQueue.push(queuedSegment);
    session.queuedSegmentCount = this.processingQueue.length;
    await this.updateSession(session);
    this.processQueue();

    return segment;
  }

  async processAudioSegmentWithAgent(
    sessionId: string,
    audioData: string,
    startTimeMs: number,
    endTimeMs: number,
    sequence: number,
    hederaAgent: any,
    hcsTopicId: string
  ): Promise<TranscriptionSegment> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('No active transcription session found');
    }

    const segmentId = `${sessionId}_${sequence}`;
    
    if (this.processedSegments.has(segmentId)) {
      console.log(`Segment ${segmentId} already processed, skipping`);
      const existingSegment = session.segments.find(s => s.segmentId === segmentId);
      if (existingSegment) {
        return existingSegment;
      }
    }
    
    const segment: TranscriptionSegment = {
      segmentId,
      sessionId,
      sequence,
      startTimeMs,
      endTimeMs,
      durationMs: endTimeMs - startTimeMs,
      text: '',
      confidence: 0,
      status: 'processing',
      timestamp: Date.now(),
      isFinal: false,
      agentProcessed: false
    };

    session.segments.push(segment);
    await this.updateSession(session);

    const queuedSegment: QueuedSegment = {
      segmentId,
      sessionId,
      audioData,
      startTimeMs,
      endTimeMs,
      sequence,
      attempts: 0,
      hederaAgent,
      hcsTopicId
    };

    this.processingQueue.push(queuedSegment);
    session.queuedSegmentCount = this.processingQueue.length;
    await this.updateSession(session);
    this.processQueue();

    return segment;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const queuedSegment = this.processingQueue.shift()!;
      const { segmentId, sessionId, audioData, sequence, hederaAgent, hcsTopicId } = queuedSegment;

      if (this.processedSegments.has(segmentId)) {
        console.log(`Segment ${segmentId} already processed, skipping from queue`);
        continue;
      }

      const session = await this.getSession(sessionId);
      if (!session) {
        console.error(`Session ${sessionId} not found, skipping segment ${segmentId}`);
        continue;
      }

      const segment = session.segments.find(s => s.segmentId === segmentId);
      if (!segment) {
        console.error(`Segment ${segmentId} not found in session, skipping`);
        continue;
      }

      try {
        console.log(`🔄 [QUEUE] Processing segment ${segmentId} from queue`);
        console.log(`🔄 [QUEUE] Queue length: ${this.processingQueue.length + 1}`);
        console.log(`🔄 [QUEUE] Audio data length: ${audioData.length} chars`);
        
        // Step 1: Transcribe audio
        const result = await this.transcribeAudioSegment(audioData);
        
        if (result.success && result.transcription) {
          segment.text = result.transcription.text;
          segment.confidence = result.transcription.confidence;
          segment.status = 'completed';
          segment.isFinal = true;
          segment.wordCount = result.transcription.text.split(' ').length;
          segment.agentProcessed = false;
          
          session.totalSegments++;
          session.totalWords += segment.wordCount;
          
          // Step 2: Send to agent (WAIT for completion)
          if (hederaAgent && hcsTopicId && segment.text) {
            try {
              console.log(`Sending segment ${segmentId} to agent...`);
              await hederaAgent.processTranscriptionSegment({
                sessionId: sessionId,
                topicId: hcsTopicId,
                segment: segment,
              });
              segment.agentProcessed = true;
              console.log(`✅ Agent processed segment ${segmentId} successfully`);
            } catch (agentError) {
              console.error(`❌ Agent failed to process segment ${segmentId}:`, agentError);
              segment.agentError = agentError instanceof Error ? agentError.message : 'Agent processing failed';
              segment.agentProcessed = false;
            }
          }
          
          // Only mark as fully processed if both transcription AND agent succeeded
          if (segment.agentProcessed !== false) {
            this.processedSegments.add(segmentId);
            session.processedSegmentIds.push(segmentId);
            session.queuedSegmentCount = this.processingQueue.length;
            console.log(`✅ Segment ${segmentId} fully processed (transcription + agent)`);
          }
        } else {
          segment.status = 'error';
          segment.error = result.error || 'Transcription failed';
          
          queuedSegment.attempts++;
          if (queuedSegment.attempts < this.config.maxRetries) {
            console.log(`Retrying segment ${segmentId}, attempt ${queuedSegment.attempts}`);
            this.processingQueue.unshift(queuedSegment);
          } else {
            console.error(`Max retries reached for segment ${segmentId}`);
          }
        }
      } catch (error) {
        segment.status = 'error';
        segment.error = error instanceof Error ? error.message : 'Unknown transcription error';
        
        queuedSegment.attempts++;
        if (queuedSegment.attempts < this.config.maxRetries) {
          console.log(`Retrying segment ${segmentId} due to error, attempt ${queuedSegment.attempts}`);
          this.processingQueue.unshift(queuedSegment);
        } else {
          console.error(`Max retries reached for segment ${segmentId} due to error:`, error);
        }
      }

      session.queuedSegmentCount = this.processingQueue.length;
      await this.updateSession(session);
    }

    this.isProcessing = false;
  }

  async endSession(sessionId: string): Promise<TranscriptionSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('No transcription session found');
    }

    while (this.processingQueue.length > 0 && this.isProcessing) {
      console.log('Waiting for queue to finish processing before ending session...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    session.status = 'completed';
    session.endTime = Date.now();
    session.recordingDuration = session.endTime - session.startTime;

    await this.updateSession(session);
    
    if (this.activeSession?.sessionId === sessionId) {
      this.activeSession = null;
    }

    this.processingQueue = this.processingQueue.filter(q => !q.sessionId.includes(sessionId));

    return session;
  }

  async generateMeetingSummary(sessionId: string): Promise<MeetingSummary> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('No transcription session found');
    }

    const completedSegments = session.segments.filter(s => s.status === 'completed');
    const fullTranscript = completedSegments
      .sort((a, b) => a.sequence - b.sequence)
      .map(s => s.text)
      .join(' ');

    // Basic summary generation (could be enhanced with AI)
    const summary: MeetingSummary = {
      text: this.extractSummaryPoints(fullTranscript),
      actionItems: this.extractActionItems(fullTranscript),
      keyPoints: this.extractKeyPoints(fullTranscript),
      participants: this.extractParticipants(fullTranscript),
      duration: session.recordingDuration,
      wordCount: session.totalWords
    };

    return summary;
  }

  async getSession(sessionId: string): Promise<TranscriptionSession | null> {
    if (this.activeSession?.sessionId === sessionId) {
      return this.activeSession;
    }
    const session = await StorageService.getTranscriptionSession(sessionId);
    if (session && session.processedSegmentIds) {
      session.processedSegmentIds.forEach(id => this.processedSegments.add(id));
    }
    return session;
  }

  async getAllSessions(): Promise<TranscriptionSession[]> {
    return await StorageService.getAllTranscriptionSessions();
  }

  private async updateSession(session: TranscriptionSession): Promise<void> {
    if (this.activeSession?.sessionId === session.sessionId) {
      this.activeSession = session;
    }
    await StorageService.saveTranscriptionSession(session);
  }

  private async transcribeAudioSegment(audioData: string): Promise<TranscriptionResult> {
    try {
      console.log('🎤 [TRANSCRIPTION] Sending audio to external API:', this.config.transcriptionEndpoint);
      console.log('🎤 [TRANSCRIPTION] Audio data length:', audioData.length);
      console.log('🎤 [TRANSCRIPTION] Audio data preview:', audioData.substring(0, 100) + '...');
      
      const response = await fetch(this.config.transcriptionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/v1/audio/transcriptions',
          file: audioData, // Base64 audio data
          model: 'whisper-1',
          response_format: 'verbose_json',
          timestamp_granularities: ['segment']
        })
      });
      
      console.log('🎤 [TRANSCRIPTION] API Response status:', response.status);
      console.log('🎤 [TRANSCRIPTION] API Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🎤 [TRANSCRIPTION] API Error details:', errorText);
        throw new Error(`Transcription API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Handle OpenAI's verbose_json response format
      let transcriptionText = '';
      let confidence = 0.95;
      let segments: any[] = [];

      if (data.text) {
        transcriptionText = data.text;
      } else if (data.segments && data.segments.length > 0) {
        transcriptionText = data.segments.map((seg: any) => seg.text).join(' ');
        segments = data.segments;
        // Calculate average confidence from segments
        const confidences = segments.map((seg: any) => seg.avg_logprob || 0.95);
        confidence = confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length;
      }
      
      return {
        success: true,
        transcription: {
          text: transcriptionText,
          confidence: confidence,
          segments: segments
        }
      };
    } catch (error) {
      console.error('Transcription API error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transcription failed'
      };
    }
  }

  private extractSummaryPoints(transcript: string): string {
    // Basic summary extraction - could be enhanced with AI
    const sentences = transcript.split('.').filter(s => s.trim().length > 20);
    const importantSentences = sentences.filter(s => 
      s.includes('decided') || 
      s.includes('agreed') || 
      s.includes('important') ||
      s.includes('key') ||
      s.includes('action')
    );
    
    return importantSentences.slice(0, 3).join('. ') + '.';
  }

  private extractActionItems(transcript: string): string[] {
    const actionPatterns = [
      /will\s+(\w+(?:\s+\w+)*)/gi,
      /need\s+to\s+(\w+(?:\s+\w+)*)/gi,
      /action\s+item[:\s]+([^.]+)/gi,
      /follow\s+up\s+on\s+([^.]+)/gi,
      /next\s+step[:\s]+([^.]+)/gi
    ];

    const actionItems: string[] = [];
    
    actionPatterns.forEach(pattern => {
      const matches = transcript.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (match.length > 10 && match.length < 100) {
            actionItems.push(match.trim());
          }
        });
      }
    });

    return actionItems.slice(0, 5);
  }

  private extractKeyPoints(transcript: string): string[] {
    const keywordPatterns = [
      /important[:\s]+([^.]+)/gi,
      /key\s+point[:\s]+([^.]+)/gi,
      /main\s+idea[:\s]+([^.]+)/gi,
      /priority[:\s]+([^.]+)/gi,
      /conclusion[:\s]+([^.]+)/gi
    ];

    const keyPoints: string[] = [];
    
    keywordPatterns.forEach(pattern => {
      const matches = transcript.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (match.length > 10 && match.length < 150) {
            keyPoints.push(match.trim());
          }
        });
      }
    });

    return keyPoints.slice(0, 5);
  }

  private extractParticipants(transcript: string): string[] {
    // Basic participant extraction - could be enhanced
    const participantPatterns = [
      /([A-Z][a-z]+)\s+said/gi,
      /([A-Z][a-z]+)\s+mentioned/gi,
      /([A-Z][a-z]+)[:\s]+/gi
    ];

    const participants = new Set<string>();
    
    participantPatterns.forEach(pattern => {
      const matches = transcript.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const name = match.replace(/\s+(said|mentioned|:).*/, '').trim();
          if (name.length > 2 && name.length < 20) {
            participants.add(name);
          }
        });
      }
    });

    return Array.from(participants).slice(0, 10);
  }

  updateConfig(config: Partial<TranscriptionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): TranscriptionConfig {
    return { ...this.config };
  }

  getActiveSession(): TranscriptionSession | null {
    return this.activeSession;
  }

  async pauseSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.status = 'paused';
      await this.updateSession(session);
    }
  }

  async resumeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session && session.status === 'paused') {
      session.status = 'active';
      await this.updateSession(session);
    }
  }
}