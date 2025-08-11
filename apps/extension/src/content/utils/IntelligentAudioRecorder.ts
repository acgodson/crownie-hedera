export class IntelligentAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private segmentDuration = 25000; // 25 seconds
  private segmentTimer: NodeJS.Timeout | null = null;
  private audioQueue: Blob[] = [];
  private processingQueue = false;
  private onSegmentReady: ((segment: Blob, timestamp: number) => void) | null = null;
  private startTime = 0;
  private segmentCount = 0;

  constructor(segmentDurationMs: number = 25000) {
    this.segmentDuration = Math.max(20000, Math.min(30000, segmentDurationMs)); // 20-30 seconds
  }

  async start(stream: MediaStream): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      console.log('🎵 [INTELLIGENT RECORDER] Starting recording...');
      console.log('📊 [INTELLIGENT RECORDER] Stream tracks:', stream.getTracks().map(t => t.kind));
      
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });

      this.audioChunks = [];
      this.audioQueue = [];
      this.processingQueue = false;
      this.startTime = Date.now();
      this.segmentCount = 0;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.finalizeRecording();
      };

      // Start recording
      this.mediaRecorder.start(1000); // 1 second chunks for smooth processing
      this.isRecording = true;
      console.log('✅ [INTELLIGENT RECORDER] MediaRecorder started');

      // Start segment timer
      this.startSegmentTimer();
      console.log('⏱️ [INTELLIGENT RECORDER] Segment timer started (25s intervals)');

    } catch (error) {
      console.error('❌ [INTELLIGENT RECORDER] Failed to start recording:', error);
      throw new Error(`Failed to start recording: ${error}`);
    }
  }

  private startSegmentTimer(): void {
    this.segmentTimer = setInterval(() => {
      if (this.isRecording && this.audioChunks.length > 0) {
        this.createSegment();
      }
    }, this.segmentDuration);
  }

  private createSegment(): void {
    if (this.audioChunks.length === 0) return;

    console.log(`📦 [INTELLIGENT RECORDER] Creating segment ${this.segmentCount + 1}...`);
    console.log(`📊 [INTELLIGENT RECORDER] Chunks: ${this.audioChunks.length}, Total size: ${this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0)} bytes`);

    // Create segment from accumulated chunks
    const segment = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
    const timestamp = Date.now();
    
    console.log(`✅ [INTELLIGENT RECORDER] Segment created: ${segment.size} bytes`);
    
    // Add to processing queue
    this.audioQueue.push(segment);
    
    // Clear chunks for next segment
    this.audioChunks = [];
    this.segmentCount++;

    console.log(`📋 [INTELLIGENT RECORDER] Queue length: ${this.audioQueue.length}`);

    // Process queue if not already processing
    if (!this.processingQueue) {
      this.processQueue();
    }

    // Notify segment ready
    if (this.onSegmentReady) {
      this.onSegmentReady(segment, timestamp);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.audioQueue.length === 0) return;

    this.processingQueue = true;

    while (this.audioQueue.length > 0) {
      const segment = this.audioQueue.shift();
      if (segment) {
        try {
          // Process segment (transcription, HCS, etc.)
          await this.processSegment(segment);
        } catch (error) {
          console.error('Failed to process audio segment:', error);
        }
      }
    }

    this.processingQueue = false;
  }

  private async processSegment(segment: Blob): Promise<void> {
    // This method will be called for each segment
    // You can integrate transcription and HCS processing here
    const segmentSize = segment.size;
    const segmentDuration = this.segmentDuration / 1000;
    
    console.log(`Processing segment ${this.segmentCount}: ${segmentSize} bytes, ${segmentDuration}s`);
    
    // TODO: Send to transcription service
    // TODO: Send to HCS if needed
    // TODO: Store in meeting history
  }

  private finalizeRecording(): void {
    // Create final segment if there are remaining chunks
    if (this.audioChunks.length > 0) {
      this.createSegment();
    }

    // Process any remaining segments in queue
    if (this.audioQueue.length > 0) {
      this.processQueue();
    }
  }

  stop(): void {
    if (!this.isRecording) return;

    console.log('🛑 [INTELLIGENT RECORDER] Stopping recording...');
    this.isRecording = false;

    // Stop segment timer
    if (this.segmentTimer) {
      clearInterval(this.segmentTimer);
      this.segmentTimer = null;
      console.log('⏱️ [INTELLIGENT RECORDER] Segment timer stopped');
    }

    // Stop media recorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.log(`🛑 [INTELLIGENT RECORDER] MediaRecorder state: ${this.mediaRecorder.state}`);
      this.mediaRecorder.stop();
    }

    // Finalize any remaining audio
    this.finalizeRecording();
    console.log('✅ [INTELLIGENT RECORDER] Recording stopped');
  }

  pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  // Set callback for when segments are ready
  onSegment(callback: (segment: Blob, timestamp: number) => void): void {
    this.onSegmentReady = callback;
  }

  // Get current recording stats
  getStats(): {
    isRecording: boolean;
    segmentCount: number;
    queueLength: number;
    recordingDuration: number;
    segmentDuration: number;
  } {
    return {
      isRecording: this.isRecording,
      segmentCount: this.segmentCount,
      queueLength: this.audioQueue.length,
      recordingDuration: this.isRecording ? Date.now() - this.startTime : 0,
      segmentDuration: this.segmentDuration
    };
  }

  // Adjust segment duration dynamically
  setSegmentDuration(durationMs: number): void {
    if (this.isRecording) {
      throw new Error('Cannot change segment duration while recording');
    }
    this.segmentDuration = Math.max(20000, Math.min(30000, durationMs));
  }

  // Get all recorded segments
  getAllSegments(): Blob[] {
    return [...this.audioQueue];
  }

  // Clear all segments
  clearSegments(): void {
    this.audioQueue = [];
    this.audioChunks = [];
    this.segmentCount = 0;
  }
} 