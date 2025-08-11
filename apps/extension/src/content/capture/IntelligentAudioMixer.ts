export class IntelligentAudioMixer {
  private desktopStream: MediaStream | null = null;
  private microphoneStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private desktopSource: MediaStreamAudioSourceNode | null = null;
  private microphoneSource: MediaStreamAudioSourceNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private microphoneGain: GainNode | null = null;
  private desktopGain: GainNode | null = null;
  private microphoneAnalyzer: AnalyserNode | null = null;
  private isRecording = false;
  private noiseThreshold = -45; // dB threshold for speech detection
  private speechTimeout: NodeJS.Timeout | null = null;
  private lastSpeechTime = 0;

  async startDualCapture(): Promise<MediaStream> {
    try {
      console.log('🎤 [INTELLIGENT MIXER] Starting dual capture...');
      
      // Create audio context
      this.audioContext = new AudioContext();
      console.log('✅ [INTELLIGENT MIXER] Audio context created');
      
      // Get desktop capture with audio
      console.log('🖥️ [INTELLIGENT MIXER] Requesting desktop capture...');
      this.desktopStream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      console.log('✅ [INTELLIGENT MIXER] Desktop stream captured:', this.desktopStream.getTracks().map(t => t.kind));

      // Get microphone with noise suppression
      console.log('🎙️ [INTELLIGENT MIXER] Requesting microphone access...');
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      console.log('✅ [INTELLIGENT MIXER] Microphone stream captured:', this.microphoneStream.getTracks().map(t => t.kind));

      // Create audio nodes
      this.desktopSource = this.audioContext.createMediaStreamSource(this.desktopStream);
      this.microphoneSource = this.audioContext.createMediaStreamSource(this.microphoneStream);
      this.destination = this.audioContext.createMediaStreamDestination();

      // Create gain nodes for mixing
      this.desktopGain = this.audioContext.createGain();
      this.microphoneGain = this.audioContext.createGain();

      // Create analyzer for speech detection
      this.microphoneAnalyzer = this.audioContext.createAnalyser();
      this.microphoneAnalyzer.fftSize = 256;
      this.microphoneAnalyzer.smoothingTimeConstant = 0.8;

      // Connect desktop audio (always active)
      this.desktopSource.connect(this.desktopGain);
      this.desktopGain.connect(this.destination);
      this.desktopGain.gain.value = 1.0;

      // Connect microphone with speech detection
      this.microphoneSource.connect(this.microphoneGain);
      this.microphoneGain.connect(this.microphoneAnalyzer);
      this.microphoneGain.connect(this.destination);
      
      // Start with mic muted (will be activated on speech)
      this.microphoneGain.gain.value = 0.0;

      // Start speech detection
      console.log('🎯 [INTELLIGENT MIXER] Starting speech detection...');
      this.startSpeechDetection();

      this.isRecording = true;
      console.log('🎉 [INTELLIGENT MIXER] Dual capture started successfully!');
      console.log('📊 [INTELLIGENT MIXER] Final mixed stream tracks:', this.destination.stream.getTracks().map(t => t.kind));
      return this.destination.stream;

    } catch (error) {
      console.error('❌ [INTELLIGENT MIXER] Failed to start dual capture:', error);
      throw new Error(`Failed to start dual capture: ${error}`);
    }
  }

  private startSpeechDetection(): void {
    if (!this.microphoneAnalyzer || !this.microphoneGain) return;

    const bufferLength = this.microphoneAnalyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const detectSpeech = () => {
      if (!this.isRecording) return;

      this.microphoneAnalyzer!.getByteFrequencyData(dataArray);
      
      // Calculate RMS (Root Mean Square) for volume detection
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);
      const db = 20 * Math.log10(rms / 255);

      // Check if speech level is above threshold
      if (db > this.noiseThreshold) {
        this.activateMicrophone();
        this.lastSpeechTime = Date.now();
      } else {
        // Deactivate mic after 2 seconds of silence
        if (Date.now() - this.lastSpeechTime > 2000) {
          this.deactivateMicrophone();
        }
      }

      requestAnimationFrame(detectSpeech);
    };

    detectSpeech();
  }

  private activateMicrophone(): void {
    if (this.microphoneGain) {
      // Smooth fade in to avoid audio artifacts
      this.microphoneGain.gain.setValueAtTime(0, this.audioContext!.currentTime);
      this.microphoneGain.gain.linearRampToValueAtTime(0.7, this.audioContext!.currentTime + 0.1);
    }
  }

  private deactivateMicrophone(): void {
    if (this.microphoneGain) {
      // Smooth fade out
      this.microphoneGain.gain.setValueAtTime(0.7, this.audioContext!.currentTime);
      this.microphoneGain.gain.linearRampToValueAtTime(0, this.audioContext!.currentTime + 0.1);
    }
  }

  stop(): void {
    this.isRecording = false;
    
    // Stop all streams
    if (this.desktopStream) {
      this.desktopStream.getTracks().forEach(track => track.stop());
      this.desktopStream = null;
    }
    
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => track.stop());
      this.microphoneStream = null;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clear references
    this.desktopSource = null;
    this.microphoneSource = null;
    this.destination = null;
    this.desktopGain = null;
    this.microphoneGain = null;
    this.microphoneAnalyzer = null;

    // Clear speech timeout
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
  }

  // Get individual streams for separate processing if needed
  getDesktopStream(): MediaStream | null {
    return this.desktopStream;
  }

  getMicrophoneStream(): MediaStream | null {
    return this.microphoneStream;
  }

  // Adjust noise threshold dynamically
  setNoiseThreshold(threshold: number): void {
    this.noiseThreshold = Math.max(-60, Math.min(-20, threshold));
  }

  // Get current audio levels for monitoring
  getAudioLevels(): { desktop: number; microphone: number } {
    return {
      desktop: this.desktopGain?.gain.value || 0,
      microphone: this.microphoneGain?.gain.value || 0
    };
  }
} 