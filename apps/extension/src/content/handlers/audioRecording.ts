import { IntelligentAudioRecorder } from "../utils/IntelligentAudioRecorder";
import { IntelligentAudioMixer } from "../capture/IntelligentAudioMixer";

const intelligentMixer = new IntelligentAudioMixer();
const intelligentRecorder = new IntelligentAudioRecorder(25000); // 25 second segments

export function createAudioRecordingHandler() {
  // Set up segment callback for processing
  intelligentRecorder.onSegment(async (segment: Blob, timestamp: number) => {
    try {
      // Convert segment to base64 for processing
      const arrayBuffer = await segment.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      // Send to background for transcription and HCS processing
      chrome.runtime.sendMessage({
        action: "PROCESS_AUDIO_SEGMENT",
        data: {
          audioData: base64,
          timestamp,
          segmentSize: segment.size,
          mimeType: segment.type
        }
      });
    } catch (error) {
      console.error('Failed to process audio segment:', error);
    }
  });

  function handleAudioRecordingMessage(
    message: any,
    sendResponse: (response: any) => void
  ) {
    if (!message.subAction) {
      sendResponse({
        success: false,
        error: `Audio recording message missing subAction. Message: ${JSON.stringify(
          message
        )}`,
      });
      return;
    }

    switch (message.subAction) {
      case "START":
        (async () => {
          try {
            console.log('🎬 [AUDIO HANDLER] Starting intelligent dual capture...');
            const stream = await intelligentMixer.startDualCapture();
            console.log('✅ [AUDIO HANDLER] Dual capture stream obtained');
            
            await intelligentRecorder.start(stream);
            console.log('✅ [AUDIO HANDLER] Intelligent recorder started');
            
            chrome.runtime.sendMessage({
              action: "UPDATE_RECORDING_STATE",
              data: { isRecording: true, duration: 0 }
            });
            
            sendResponse({ success: true, message: "Intelligent dual audio recording started" });
            console.log('🎉 [AUDIO HANDLER] Recording started successfully!');
          } catch (error) {
            console.error('❌ [AUDIO HANDLER] Failed to start recording:', error);
            sendResponse({ success: false, error: (error as Error).message });
          }
        })();
        break;

      case "STOP":
        (async () => {
          try {
            intelligentRecorder.stop();
            intelligentMixer.stop();
            
            chrome.runtime.sendMessage({
              action: "UPDATE_RECORDING_STATE", 
              data: { isRecording: false, duration: 0 }
            });
            
            sendResponse({ success: true, message: "Intelligent dual audio recording stopped" });
          } catch (error) {
            sendResponse({ success: false, error: (error as Error).message });
          }
        })();
        break;

      case "PAUSE":
        intelligentRecorder.pause();
        sendResponse({ success: true, message: "Audio recording paused" });
        break;

      case "RESUME":
        intelligentRecorder.resume();
        sendResponse({ success: true, message: "Audio recording resumed" });
        break;

      case "GET_STATS":
        const stats = intelligentRecorder.getStats();
        sendResponse({ success: true, stats });
        break;

      case "SET_SEGMENT_DURATION":
        try {
          const duration = parseInt(message.data?.duration || "25000");
          intelligentRecorder.setSegmentDuration(duration);
          sendResponse({ success: true, message: `Segment duration set to ${duration}ms` });
        } catch (error) {
          sendResponse({ success: false, error: (error as Error).message });
        }
        break;

      default:
        sendResponse({
          success: false,
          error: `Unknown audio recording sub-action: ${message.subAction}`,
        });
    }
  }

  return { handleAudioRecordingMessage };
} 