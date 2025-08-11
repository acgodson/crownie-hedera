export interface AudioStreamInfo {
  stream: MediaStream;
  type: 'outgoing' | 'incoming';
  label: string;
  id: string;
  startTime: number;
}

export class AudioStreamManager {
  private streams = new Map<string, AudioStreamInfo>();
  private mixedStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private sources = new Map<string, MediaStreamAudioSourceNode>();

  addStream(stream: MediaStream, type: 'outgoing' | 'incoming', label?: string): string {
    const id = this.generateStreamId();
    const streamInfo: AudioStreamInfo = {
      stream,
      type,
      label: label || `${type}-${id}`,
      id,
      startTime: Date.now()
    };

    this.streams.set(id, streamInfo);
    this.updateMixedStream();
    
    return id;
  }

  removeStream(id: string): void {
    const streamInfo = this.streams.get(id);
    if (!streamInfo) return;

    const source = this.sources.get(id);
    if (source) {
      source.disconnect();
      this.sources.delete(id);
    }

    streamInfo.stream.getTracks().forEach(track => track.stop());
    this.streams.delete(id);
    this.updateMixedStream();
  }

  getMixedStream(): MediaStream | null {
    return this.mixedStream;
  }

  getStreamInfo(id: string): AudioStreamInfo | undefined {
    return this.streams.get(id);
  }

  getAllStreams(): AudioStreamInfo[] {
    return Array.from(this.streams.values());
  }

  private updateMixedStream(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.destination = this.audioContext.createMediaStreamDestination();
    }

    this.sources.forEach(source => source.disconnect());
    this.sources.clear();

    this.streams.forEach((streamInfo, id) => {
      if (streamInfo.stream.getAudioTracks().length > 0 && this.audioContext && this.destination) {
        const source = this.audioContext.createMediaStreamSource(streamInfo.stream);
        source.connect(this.destination);
        this.sources.set(id, source);
      }
    });

    if (this.destination) {
      this.mixedStream = this.destination.stream;
    }
  }

  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy(): void {
    this.streams.forEach((_, id) => this.removeStream(id));
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.destination = null;
    this.mixedStream = null;
    this.sources.clear();
    this.streams.clear();
  }
}