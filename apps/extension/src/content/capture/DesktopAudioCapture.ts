export class DesktopAudioCapture {
  private currentStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;

  constructor() {}

  async captureDesktopWithAudio() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('getDisplayMedia not supported in this context');
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      this.currentStream = stream;
      return this.filterMeetingAudio(stream);
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Permission denied - user must allow screen sharing with audio');
      } else if (error.name === 'NotSupportedError') {
        throw new Error('Screen sharing not supported in this context');
      } else {
        throw new Error(`Desktop capture failed: ${error.message}`);
      }
    }
  }

  filterMeetingAudio(stream: MediaStream): MediaStream {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.destination = this.audioContext.createMediaStreamDestination();
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('No audio tracks found in desktop capture');
    }

    const audioTrack = audioTracks[0];
    const sourceStream = new MediaStream([audioTrack]);
    const source = this.audioContext.createMediaStreamSource(sourceStream);
    
    if (this.destination) {
      source.connect(this.destination);
      return this.destination.stream;
    }
    
    throw new Error('Failed to create audio destination');
  }

  stop() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.destination = null;
  }

  isActive() {
    return this.currentStream !== null;
  }
} 