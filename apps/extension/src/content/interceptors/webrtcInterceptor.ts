interface AudioStreamCallback {
  (stream: MediaStream, type: 'outgoing' | 'incoming', label?: string): void;
}

export class WebRTCInterceptor {
  private audioStreamCallback: AudioStreamCallback | null = null;
  private originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia;
  private originalRTCPeerConnection: typeof RTCPeerConnection;
  private isInitialized = false;

  constructor() {
    this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    this.originalRTCPeerConnection = window.RTCPeerConnection;
  }

  initialize(callback: AudioStreamCallback): void {
    if (this.isInitialized) return;

    this.audioStreamCallback = callback;
    this.interceptGetUserMedia();
    this.interceptRTCPeerConnection();
    this.isInitialized = true;
  }

  private interceptGetUserMedia(): void {
    navigator.mediaDevices.getUserMedia = async (constraints: MediaStreamConstraints) => {
      const stream = await this.originalGetUserMedia(constraints);
      
      if (constraints.audio && stream.getAudioTracks().length > 0 && this.audioStreamCallback) {
        this.audioStreamCallback(stream, 'outgoing', 'user-microphone');
      }

      return stream;
    };
  }

  private interceptRTCPeerConnection(): void {
    const self = this;
    
    window.RTCPeerConnection = class extends self.originalRTCPeerConnection {
      constructor(config?: RTCConfiguration) {
        super(config);
        
        const originalOntrack = this.ontrack;
        this.ontrack = (event: RTCTrackEvent) => {
          if (event.track.kind === 'audio' && self.audioStreamCallback) {
            const stream = new MediaStream([event.track]);
            const participantLabel = this.extractParticipantLabel(event);
            self.audioStreamCallback(stream, 'incoming', participantLabel);
          }

          if (originalOntrack) {
            originalOntrack.call(this, event);
          }
        };

        this.addEventListener('track', (event: RTCTrackEvent) => {
          if (event.track.kind === 'audio' && self.audioStreamCallback) {
            const stream = new MediaStream([event.track]);
            const participantLabel = this.extractParticipantLabel(event);
            self.audioStreamCallback(stream, 'incoming', participantLabel);
          }
        });
      }

      private extractParticipantLabel(event: RTCTrackEvent): string {
        const transceiver = event.transceiver;
        return transceiver?.mid || `participant-${Date.now()}`;
      }
    };
  }

  destroy(): void {
    if (!this.isInitialized) return;

    navigator.mediaDevices.getUserMedia = this.originalGetUserMedia;
    window.RTCPeerConnection = this.originalRTCPeerConnection;
    this.audioStreamCallback = null;
    this.isInitialized = false;
  }
}

export const webrtcInterceptor = new WebRTCInterceptor();