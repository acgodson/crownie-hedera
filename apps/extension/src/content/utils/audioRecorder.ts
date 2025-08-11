export class AudioBufferRecorder {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordingStartTimeMs = 0;
  private lastChunkEndOffsetMs = 0;
  private chunks: Array<{
    startTimeMs: number;
    endTimeMs: number;
    blob: Blob;
  }> = [];
  private readonly chunkTimesliceMs = 1000;
  private segmentTimer: NodeJS.Timeout | null = null;
  private segmentDuration = 30000;
  private segmentSequence = 0;
  private isPaused = false;

  async start(stream?: MediaStream): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      return;
    }

    if (!stream) {
      throw new Error('No audio stream provided. WebRTC interceptor must be initialized first.');
    }

    this.mediaStream = stream;
    
    if (this.mediaStream.getAudioTracks().length === 0) {
      throw new Error('Provided stream contains no audio tracks');
    }

    const options = this.getMediaRecorderOptions();
    this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
    this.chunks = [];
    this.recordingStartTimeMs = Date.now();
    this.lastChunkEndOffsetMs = 0;
    this.segmentSequence = 0;

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (!event.data || event.data.size === 0) return;
      const nowOffset = Date.now() - this.recordingStartTimeMs;
      const startTimeMs = this.lastChunkEndOffsetMs;
      const endTimeMs = nowOffset;
      this.chunks.push({ startTimeMs, endTimeMs, blob: event.data });
      this.lastChunkEndOffsetMs = endTimeMs;
      console.log(`📊 Audio chunk: ${event.data.size} bytes`);
    };

    this.mediaRecorder.onerror = (error) => {
      console.error('❌ MediaRecorder error:', error);
    };

    this.mediaRecorder.onstop = () => {
      console.log('⏹️ MediaRecorder stopped');
    };

    this.mediaRecorder.start(this.chunkTimesliceMs);
    this.startSegmentProcessing();
    
    console.log('Audio recording started with WebRTC stream');
  }

  async stop(): Promise<void> {
    if (this.segmentTimer) {
      clearInterval(this.segmentTimer);
      this.segmentTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        this.mediaRecorder!.onstop = () => resolve();
        this.mediaRecorder!.stop();
      });
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    console.log('Audio recording stopped');
  }

  private startSegmentProcessing(): void {
    this.segmentTimer = setInterval(async () => {
      if (this.isPaused) {
        return;
      }

      try {
        const currentTime = Date.now();
        const segmentStart = currentTime - this.segmentDuration;
        const segmentEnd = currentTime;
        const duration = Math.floor((currentTime - this.recordingStartTimeMs) / 1000);

        chrome.runtime.sendMessage({
          action: "UPDATE_RECORDING_STATE",
          data: { isRecording: true, duration }
        }).catch(() => {});

        const base64Audio = await this.captureSegmentBase64(
          segmentStart - this.recordingStartTimeMs,
          segmentEnd - this.recordingStartTimeMs
        );

        if (base64Audio && base64Audio.length > 0) {
          chrome.runtime
            .sendMessage({
              action: "AUDIO_RECORDING",
              subAction: "CAPTURE_SEGMENT",
              data: {
                audioData: base64Audio,
                startTimeMs: segmentStart,
                endTimeMs: segmentEnd,
                sequence: this.segmentSequence,
              },
            })
            .then(() => {})
            .catch((error) => {
              console.error("[AUDIO] Failed to send segment:", error);
            });

          this.segmentSequence++;
        }
      } catch (error) {
        console.error("[AUDIO] Error processing segment:", error);
      }
    }, this.segmentDuration);
  }

  pauseProcessing(): void {
    this.isPaused = true;
  }

  resumeProcessing(): void {
    this.isPaused = false;
  }

  async getRecordedAudio(): Promise<Blob | null> {
    if (this.chunks.length === 0) {
      return null;
    }

    const allBlobs = this.chunks.map((chunk) => chunk.blob);
    const combinedBlob = new Blob(allBlobs, {
      type: this.chunks[0].blob.type || "audio/webm",
    });
    return combinedBlob;
  }

  async playRecordedAudio(): Promise<void> {
    const audioBlob = await this.getRecordedAudio();
    if (!audioBlob) {
      console.error("[AUDIO] No recorded audio to play");
      return;
    }

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
    };

    audio.onerror = (error) => {
      URL.revokeObjectURL(audioUrl);
      console.error("[AUDIO] Playback failed:", error);
    };

    try {
      await audio.play();
    } catch (error) {
      URL.revokeObjectURL(audioUrl);
      console.error("[AUDIO] Failed to start playback:", error);
      throw error;
    }
  }

  async captureSegmentBase64(
    startTimeMs: number,
    endTimeMs: number
  ): Promise<string | null> {
    if (!this.chunks.length) return null;
    const selected: Blob[] = [];
    for (const c of this.chunks) {
      const overlaps = !(
        c.endTimeMs <= startTimeMs || c.startTimeMs >= endTimeMs
      );
      if (overlaps) selected.push(c.blob);
    }
    if (selected.length === 0) return null;

    const mimeType = this.chunks[0].blob.type || "audio/webm";
    const merged = new Blob(selected, { type: mimeType });

    const minSizeBytes = 1000;
    if (merged.size < minSizeBytes) {
      return null;
    }

    const base64 = await this.readBlobAsBase64(merged);

    if (!base64 || base64.length < 100) {
      return null;
    }

    return base64;
  }

  private getMediaRecorderOptions(): MediaRecorderOptions {
    const mimeTypes = [
      "audio/wav",
      "audio/webm;codecs=opus",
      "audio/webm;codecs=pcm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/webm",
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log(`[AUDIO] Using MIME type: ${mimeType}`);
        return { mimeType };
      }
    }

    console.log("[AUDIO] No supported MIME type found, using default");
    return {};
  }

  private readBlobAsBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const commaIndex = result.indexOf(",");
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };
      reader.onerror = () => reject(new Error("Failed to read audio blob"));
      reader.readAsDataURL(blob);
    });
  }
}