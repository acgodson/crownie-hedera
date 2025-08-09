export class AudioCaptureService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private segmentDuration = 5000; // 5 seconds per segment
  private segmentTimer: NodeJS.Timeout | null = null;
  private onSegmentCallback: ((audioData: string, startTime: number, endTime: number, sequence: number) => void) | null = null;
  private segmentSequence = 0;
  private recordingStartTime = 0;

  async startRecording(onSegment: (audioData: string, startTime: number, endTime: number, sequence: number) => void): Promise<void> {
    try {
      console.log('🎤 [AUDIO] Requesting microphone access...');
      
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('✅ [AUDIO] Microphone access granted');

      // Set up MediaRecorder
      const mimeType = this.getSupportedMimeType();
      console.log('🎤 [AUDIO] Using MIME type:', mimeType);
      
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000
      });

      this.onSegmentCallback = onSegment;
      this.audioChunks = [];
      this.segmentSequence = 0;
      this.recordingStartTime = Date.now();
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log('🎤 [AUDIO] Audio chunk received:', event.data.size, 'bytes');
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processAudioSegment();
      };

      // Start recording
      this.mediaRecorder.start();
      this.isRecording = true;
      
      console.log('✅ [AUDIO] Recording started');
      
      // Set up segment processing
      this.startSegmentTimer();
      
    } catch (error) {
      console.error('❌ [AUDIO] Failed to start recording:', error);
      throw new Error(`Failed to access microphone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async stopRecording(): Promise<void> {
    console.log('🎤 [AUDIO] Stopping recording...');
    
    this.isRecording = false;
    
    if (this.segmentTimer) {
      clearInterval(this.segmentTimer);
      this.segmentTimer = null;
    }
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    this.mediaRecorder = null;
    this.onSegmentCallback = null;
    
    console.log('✅ [AUDIO] Recording stopped');
  }

  private startSegmentTimer(): void {
    this.segmentTimer = setInterval(() => {
      if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        console.log('🎤 [AUDIO] Processing segment', this.segmentSequence);
        
        // Stop and restart recorder to get current segment
        this.mediaRecorder.stop();
        
        // Restart for next segment
        setTimeout(() => {
          if (this.isRecording && this.mediaRecorder) {
            this.audioChunks = [];
            this.mediaRecorder.start();
          }
        }, 100);
      }
    }, this.segmentDuration);
  }

  private async processAudioSegment(): Promise<void> {
    if (this.audioChunks.length === 0) {
      console.warn('⚠️ [AUDIO] No audio chunks to process');
      return;
    }

    try {
      const segmentStartTime = Date.now() - this.segmentDuration;
      const segmentEndTime = Date.now();
      
      console.log('🎤 [AUDIO] Processing audio segment:', {
        chunks: this.audioChunks.length,
        sequence: this.segmentSequence,
        duration: this.segmentDuration
      });

      // Combine audio chunks
      const audioBlob = new Blob(this.audioChunks, { type: this.getSupportedMimeType() });
      console.log('🎤 [AUDIO] Created audio blob:', audioBlob.size, 'bytes');

      // Convert to base64
      const base64Audio = await this.blobToBase64(audioBlob);
      console.log('🎤 [AUDIO] Converted to base64:', base64Audio.length, 'characters');

      // Call the segment callback
      if (this.onSegmentCallback) {
        this.onSegmentCallback(base64Audio, segmentStartTime, segmentEndTime, this.segmentSequence);
      }
      
      this.segmentSequence++;
      
    } catch (error) {
      console.error('❌ [AUDIO] Failed to process segment:', error);
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result && typeof reader.result === 'string') {
          // Remove data URL prefix (e.g., "data:audio/webm;base64,")
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/m4a',
      'audio/wav'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return 'audio/webm'; // Fallback
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }
}