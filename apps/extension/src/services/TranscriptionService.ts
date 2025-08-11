interface TranscriptionResult {
  success: boolean;
  text?: string;
  confidence?: number;
  error?: string;
}

export class TranscriptionService {
  private transcriptionEndpoint: string;

  constructor() {
    this.transcriptionEndpoint = 'https://us-central1-blueband-db-442d8.cloudfunctions.net/proxy';
  }

  async transcribeAudio(audioData: string): Promise<TranscriptionResult> {
    try {
      // Validate input
      if (!audioData || audioData.length < 1000) {
        console.log('🎤 [TRANSCRIPTION] Skipping - audio data too small or empty:', audioData.length);
        return {
          success: false,
          error: 'Audio data too small or empty'
        };
      }

      console.log('🎤 [TRANSCRIPTION] Calling endpoint:', this.transcriptionEndpoint);
      console.log('🎤 [TRANSCRIPTION] Audio data length:', audioData.length);
      
      const response = await fetch(this.transcriptionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/v1/audio/transcriptions',
          file: audioData,
          model: 'whisper-1',
          response_format: 'verbose_json',
          timestamp_granularities: ['segment']
        })
      });

      console.log('🎤 [TRANSCRIPTION] Response status:', response.status);
      console.log('🎤 [TRANSCRIPTION] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🎤 [TRANSCRIPTION] Error response:', errorText);
        throw new Error(`Transcription API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      let transcriptionText = '';
      let confidence = 0.95;

      if (data.text) {
        transcriptionText = data.text;
      } else if (data.segments && data.segments.length > 0) {
        transcriptionText = data.segments.map((seg: any) => seg.text).join(' ');
        const confidences = data.segments.map((seg: any) => seg.avg_logprob || 0.95);
        confidence = confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length;
      }
      
      return {
        success: true,
        text: transcriptionText,
        confidence: confidence
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transcription failed'
      };
    }
  }
}