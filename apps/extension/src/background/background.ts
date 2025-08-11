import "../utils/nodePolyfills";
import browser from "webextension-polyfill";
import { HederaAgent } from "../agents/HederaAgent";
import { StorageService } from "../services/StorageService";
import { MeetingService } from "../services/MeetingService";
import { TranscriptionService } from "../services/TranscriptionService";
import type { MeetingSession, AgentConfig } from "../types";

interface QueuedSegment {
  sessionId: string;
  audioData: string;
  startTimeMs: number;
  endTimeMs: number;
  sequence: number;
  attempts: number;
}

class CrownieHederaBackground {
  private hederaAgent: HederaAgent;
  private meetingService: MeetingService;
  private transcriptionService: TranscriptionService;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private currentMeetingInfo: any = null;
  private processingQueue: QueuedSegment[] = [];
  private isProcessingQueue = false;
  private queuePaused = false;
  private tabCaptureStream: MediaStream | null = null;
  private tabMediaRecorder: MediaRecorder | null = null;
  private tabAudioChunks: Blob[] = [];

  constructor() {
    this.hederaAgent = new HederaAgent();
    this.meetingService = new MeetingService();
    this.transcriptionService = new TranscriptionService();
    this.setupMessageListener();
    this.setupKeepalive();
    this.initializeAgentIfReady();
  }

  private async initializeAgentIfReady(): Promise<void> {
    try {
      const isOnboardingCompleted = await StorageService.isOnboardingCompleted();
      if (isOnboardingCompleted) {
        console.log("🚀 Onboarding completed, initializing agent...");
        await this.initializeAgent();
      } else {
        console.log("⏳ Onboarding not completed, skipping agent initialization");
        this.isInitialized = false;
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      this.isInitialized = false;
    }
  }

  private async initializeAgent(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        const currentState = this.hederaAgent.getState();
        if (currentState.status === "active" && this.isInitialized) {
          return;
        }

        const config: Partial<AgentConfig> = {
          network: "testnet",
          maxTranscriptionChunkSize: 1000,
          transcriptionInterval: 5000,
          heartbeatInterval: 30000,
        };

        let restoredState = await this.hederaAgent.restoreFromStorage();

        if (restoredState && restoredState.status === "active") {
          this.isInitialized = true;
          return;
        }

        const newState = await this.hederaAgent.initialize(config);

        if (newState.status === "active") {
          this.isInitialized = true;
          return;
        } else {
          if (
            newState.errorMessage &&
            (newState.errorMessage.includes("No identity found") ||
              newState.errorMessage.includes("API key not found"))
          ) {
            this.isInitialized = false;
            return;
          }

          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      } catch (error) {
        console.error(
          `Agent initialization failed (attempt ${attempts}/${maxAttempts}):`,
          error
        );

        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    console.error("Agent initialization failed after all attempts");
    this.isInitialized = false;
  }

  private async checkAndUpdateInitializationStatus(): Promise<void> {
    try {
      const agentState = this.hederaAgent.getState();
      const isReady = await this.hederaAgent.isAgentReady();

      if (agentState.status === "active" && isReady) {
        if (!this.isInitialized) {
          this.isInitialized = true;
        }
      } else {
        if (this.isInitialized) {
          this.isInitialized = false;
        }
      }
    } catch (error) {
      console.error("Error checking initialization status:", error);
      this.isInitialized = false;
    }
  }

  private setupMessageListener() {
    browser.runtime.onMessage.addListener(async (message: any, sender: any) => {
      try {
        switch (message?.action) {
          case "MEETING_DETECTED":
            return await this.handleMeetingDetected(message.data);
          case "MEETING_ENDED":
            this.currentMeetingInfo = null;
            return { success: true };
          case "GET_MEETING_STATUS":
            return await this.getMeetingStatus();
          case "START_RECORDING":
            return await this.startRecording(message.sessionId);
          case "STOP_RECORDING":
            return await this.stopRecording(message.sessionId);
          case "START_TRANSCRIPTION":
            return await this.startTranscription(message.sessionId);
          case "STOP_TRANSCRIPTION":
            return await this.stopTranscription();
          case "GET_TRANSCRIPTION_STATUS":
            return await this.getTranscriptionStatus();
          case "AGENT_TOOL_CALL":
            return await this.handleAgentToolCall(message.data);
          case "AUDIO_RECORDING":
            return await this.handleAudioRecording(message);
          case "START_TRADE":
            return await this.handleStartTrade(message.data);
          case "STOP_TRADE":
            return await this.handleStopTrade();
          case "HEALTH_CHECK":
            return await this.healthCheck();
          case "GET_AGENT_STATE":
            return await this.getAgentState();
          case "GET_ACCOUNT_BALANCE":
            return await this.getAccountBalance();
          case "SAVE_MEETING_SECRET":
            return await this.saveMeetingSecret(message.data);
          case "GET_MEETING_SECRET":
            return await this.getMeetingSecret(message.data);
          case "IMPORT_ACCOUNT":
            return await this.importAccount(message.data);
          case "REINITIALIZE_AGENT":
            return await this.reinitializeAgent();
          case "TEST_CRYPTO":
            return await this.testCrypto();
          case "OPEN_POPUP":
            return await this.openPopup();
          case "GET_MEETING_SESSIONS":
            return await this.getMeetingSessions();
          case "REQUEST_SCREEN_CAPTURE":
            return await this.requestScreenCapture();
          case "REQUEST_TAB_CAPTURE":
            return await this.requestTabCapture();
          case "STOP_TAB_CAPTURE":
            return await this.stopTabCapture();
          case "UPDATE_RECORDING_STATUS":
            await this.notifyContentScripts({
              type: "RECORDING_STATUS_UPDATE",
              data: message.data
            });
            return { success: true };
          case "PAUSE_RECORDING":
            await this.notifyContentScripts({
              action: "PAUSE_RECORDING"
            });
            return { success: true };
          case "RESUME_RECORDING":
            await this.notifyContentScripts({
              action: "RESUME_RECORDING"
            });
            return { success: true };
          case "UPDATE_RECORDING_DURATION":
            await this.notifyContentScripts({
              action: "UPDATE_RECORDING_DURATION",
              data: { duration: message.data.duration }
            });
            return { success: true };
          case "RESET_QUEUE":
            return await this.resetQueue();
          case "GET_TOPIC_MESSAGES":
            return await this.getTopicMessages(message.data);
          case "GENERATE_SUMMARY":
            return await this.generateSummary(message.data);
          default:
            return { error: `Unknown action: ${message?.action}` };
        }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Unknown error",
          success: false,
        };
      }
    });
  }

  private setupKeepalive(): void {
    this.keepAliveInterval = setInterval(async () => {
      try {
        await this.checkAndUpdateInitializationStatus();
        await StorageService.updateLastHeartbeat();
      } catch (error) {
        console.error("Keepalive error:", error);
      }
    }, 30000);
  }

  private async notifyContentScripts(message: any): Promise<void> {
    try {
      const tabs = await browser.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await browser.tabs.sendMessage(tab.id, message);
          } catch (error) {}
        }
      }
    } catch (error) {}
  }

  private async handleMeetingDetected(data: any): Promise<any> {
    try {
      this.currentMeetingInfo = data;

      if (!this.isInitialized) {
        return {
          success: true,
          message: "Meeting detected but agent not initialized",
        };
      }

      const sessionId = `meeting_${data.meetingId}_${Date.now()}`;
      const meetingSession = {
        sessionId,
        meetingInfo: {
          platform: data.platform,
          isActive: data.isActive,
          meetingId: data.meetingId,
          title: data.title,
          startTime: Date.now(),
        },
        hcsTopicId: "",
        isRecording: false,
        recordingStartTime: null,
        recordingDuration: 0,
        transcriptionEnabled: false,
        status: "detected" as const,
        createdAt: Date.now(),
      };

      await this.hederaAgent.saveMeetingSession(meetingSession);

      return {
        success: true,
        sessionId,
        message: "Meeting detected and session created",
      };
    } catch (error) {
      console.error("Failed to handle meeting detection:", error);
      throw error;
    }
  }

  private async getMeetingStatus(): Promise<any> {
    try {
      const activeSessions = await this.hederaAgent.getActiveSessions();

      const latestSession = activeSessions[activeSessions.length - 1];

      if (!latestSession && !this.currentMeetingInfo) {
        return {
          isMeetingDetected: false,
          isRecording: false,
          recordingDuration: 0,
        };
      }

      if (latestSession) {
        return {
          isMeetingDetected: true,
          platform: latestSession.meetingInfo.platform,
          meetingId: latestSession.meetingInfo.meetingId,
          title: latestSession.meetingInfo.title,
          isRecording: latestSession.isRecording,
          recordingDuration: latestSession.recordingDuration,
          sessionId: latestSession.sessionId,
          hcsTopicId: latestSession.hcsTopicId,
        };
      }

      if (this.currentMeetingInfo) {
        return {
          isMeetingDetected: true,
          platform: this.currentMeetingInfo.platform,
          meetingId: this.currentMeetingInfo.meetingId,
          title: this.currentMeetingInfo.title,
          isRecording: false,
          recordingDuration: 0,
        };
      }

      return {
        isMeetingDetected: false,
        isRecording: false,
        recordingDuration: 0,
      };
    } catch (error) {
      console.error("Error getting meeting status:", error);
      return {
        isMeetingDetected: false,
        isRecording: false,
        recordingDuration: 0,
      };
    }
  }

  private async startRecording(sessionId?: string): Promise<any> {
    try {
      console.log("🔧 [BACKGROUND] Starting recording...", { sessionId });
      
      if (!this.isInitialized) {
        console.error("❌ [BACKGROUND] Agent not initialized - cannot start recording");
        throw new Error("Agent not initialized - cannot start recording");
      }

      let session: MeetingSession | null = null;

      if (sessionId) {
        console.log("🔍 [BACKGROUND] Looking for specific session:", sessionId);
        session = await StorageService.getMeetingSession(sessionId);
      } else {
        console.log("🔍 [BACKGROUND] Looking for active meeting session...");
        const activeSessions = await this.hederaAgent.getActiveSessions();
        const foundSession = activeSessions.find((s) => !s.isRecording);
        if (foundSession) {
          session = foundSession;
        }
        console.log("📋 [BACKGROUND] Active sessions found:", activeSessions.length);
      }

      if (!session) {
        console.log("🔧 [BACKGROUND] No active session found, creating new one...");
        const currentMeetingInfo = await this.meetingService.detectMeeting();
        
        if (!currentMeetingInfo) {
          console.error("❌ [BACKGROUND] No active meeting detected");
          throw new Error("No active meeting detected");
        }

        console.log("✅ [BACKGROUND] Current meeting info:", currentMeetingInfo);

        const newSession: MeetingSession = {
          sessionId: `session_${Date.now()}`,
          meetingInfo: currentMeetingInfo,
          hcsTopicId: "",
          isRecording: false,
          recordingStartTime: null,
          recordingDuration: 0,
          transcriptionEnabled: false,
          status: "detected" as const,
          createdAt: Date.now(),
        };

        await this.hederaAgent.saveMeetingSession(newSession);
        session = newSession;
        console.log("✅ [BACKGROUND] New session created:", newSession.sessionId);
      }

      if (!session) {
        console.error("❌ [BACKGROUND] No active meeting found");
        throw new Error(
          "No active meeting found - please join a meeting first"
        );
      }

              if (session.isRecording) {
          return { success: false, error: "Recording already in progress" };
        }

      console.log("🔍 [BACKGROUND] Checking for existing topic...");
      let topicId = await StorageService.getMeetingTopic(session.meetingInfo.meetingId);
      
      if (topicId) {
        console.log("✅ [BACKGROUND] Found existing topic:", topicId);
      }

      if (!topicId) {
        console.log("🔧 [BACKGROUND] No existing topic found, creating new one...");
        console.log("🔧 [BACKGROUND] Meeting info:", {
          title: session.meetingInfo.title,
          meetingId: session.meetingInfo.meetingId,
          platform: session.meetingInfo.platform
        });
        
        const proxyResult = await this.proxyHederaOperation({
          operation: 'CREATE_TOPIC',
          memo: `Crownie meeting: ${session.meetingInfo.title} (${session.meetingInfo.meetingId}) - ${new Date().toISOString()}`
        });
        
        console.log("✅ [BACKGROUND] Proxy operation result:", proxyResult);
        topicId = proxyResult.topicId;
      }

      if (!topicId) {
        console.error("❌ [BACKGROUND] Failed to create or retrieve topic ID");
        throw new Error("Failed to create or retrieve topic ID");
      }
      
      console.log("🎯 [BACKGROUND] Final topic ID:", topicId);
      
      if (session.meetingInfo.meetingId) {
        console.log("💾 [BACKGROUND] Saving meeting topic mapping...");
        await StorageService.saveMeetingTopic(session.meetingInfo.meetingId, topicId);
        console.log("✅ [BACKGROUND] Meeting topic mapping saved");
      }

      console.log("🔧 [BACKGROUND] Session details:", {
        sessionId: session.sessionId,
        meetingId: session.meetingInfo.meetingId,
        topicId: topicId
      });

      console.log("🔧 [BACKGROUND] Checking if we have a valid sessionId...");
      if (!session.sessionId) {
        console.error("❌ [BACKGROUND] Session has no sessionId");
        throw new Error("Session missing sessionId");
      }

      console.log("🔧 [BACKGROUND] Using sessionId:", session.sessionId);
      
      console.log("🔧 [BACKGROUND] Updating meeting session with topic ID...");
      await this.hederaAgent.updateMeetingSession(session.sessionId, {
        hcsTopicId: topicId,
        status: "recording" as const,
      });
      console.log("✅ [BACKGROUND] Meeting session updated");

      console.log("🔧 [BACKGROUND] Starting recording with Hedera agent...");
      await this.hederaAgent.startRecording(session.sessionId);
      console.log("✅ [BACKGROUND] Hedera agent recording started");

      console.log("🔧 [BACKGROUND] Notifying content scripts to start audio recording...");
      this.notifyContentScripts({
        action: "AUDIO_RECORDING",
        subAction: "START",
      });
      console.log("✅ [BACKGROUND] Audio recording notification sent");

      console.log("🔧 [BACKGROUND] Notifying content scripts to update recording state...");
      this.notifyContentScripts({
        action: "UPDATE_RECORDING_STATE",
        data: { isRecording: true, duration: 0 }
      });
      console.log("✅ [BACKGROUND] Recording state notification sent");

      console.log("🎉 [BACKGROUND] Recording started successfully!");
      return {
        success: true,
        sessionId: session.sessionId,
        topicId: topicId,
      };
    } catch (error) {
      throw error;
    }
  }

  private async stopRecording(sessionId?: string): Promise<any> {
    try {
      if (!sessionId) {
        const activeSessions = await this.hederaAgent.getActiveSessions();
        const recordingSession = activeSessions.find((s) => s.isRecording);
        if (!recordingSession) {
          return {
            success: false,
            error: "No recording session found",
          };
        }
        sessionId = recordingSession.sessionId;
      }

      const sessions = await this.hederaAgent.getActiveSessions();
      const activeSession = sessions.find((s) => s.sessionId === sessionId);
      if (!activeSession) {
        return {
          success: false,
          error: "Session not found",
        };
      }

      if (!this.isInitialized) {
        throw new Error("Agent not initialized - cannot stop recording");
      }

      await this.hederaAgent.stopRecording(sessionId);

      await this.stopTabCapture();

      this.notifyContentScripts({
        action: "AUDIO_RECORDING",
        subAction: "STOP",
      });

      await this.notifyContentScripts({
        action: "UPDATE_RECORDING_STATE",
        data: { isRecording: false, duration: 0 },
      });

      return {
        success: true,
        message: "Recording stopped with agent workflow",
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to stop recording",
      };
    }
  }

  private async startTranscription(sessionId?: string): Promise<any> {
    try {
      if (!this.isInitialized) {
        throw new Error("Agent not initialized");
      }

      let meetingSession: MeetingSession | null = null;

      if (sessionId) {
        meetingSession = await StorageService.getMeetingSession(sessionId);
      } else {
        const activeSessions = await this.hederaAgent.getActiveSessions();
        meetingSession = activeSessions[activeSessions.length - 1];
      }

      if (!meetingSession) {
        throw new Error("No active meeting session found");
      }

      await this.hederaAgent.enableTranscription(sessionId!);

      return {
        success: true,
        message: "Transcription enabled",
        sessionId: meetingSession.sessionId,
      };
    } catch (error) {
      throw error;
    }
  }

  private async stopTranscription(): Promise<any> {
    try {
      return { success: true, message: "Transcription disabled" };
    } catch (error) {
      throw error;
    }
  }

  private async getTranscriptionStatus(): Promise<any> {
    try {
      const activeSessions = await this.hederaAgent.getActiveSessions();
      const transcriptionSession = activeSessions.find(
        (s) => s.transcriptionEnabled
      );

      return {
        isTranscribing: !!transcriptionSession,
        isAvailable: this.isInitialized,
        currentSession: transcriptionSession
          ? {
              sessionId: transcriptionSession.sessionId,
              startTime: transcriptionSession.createdAt,
              isRecording: transcriptionSession.isRecording,
            }
          : null,
      };
    } catch (error) {
      return {
        isTranscribing: false,
        isAvailable: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async handleAgentToolCall(toolCall: any): Promise<any> {
    try {
      if (toolCall.name === "create_topic_tool") {
        return await this.proxyHederaOperation({
          operation: 'CREATE_TOPIC',
          ...toolCall.arguments
        });
      }

      const result = await this.hederaAgent.executeAgentTask(
        `Execute tool: ${toolCall.name}`,
        { toolCall }
      );

      return result;
    } catch (error) {
      throw error;
    }
  }


  private async proxyHederaOperation(operationData: any): Promise<any> {
    try {
      console.log("🔧 [PROXY] Starting Hedera operation via content script proxy:", operationData);
      
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      
      if (tabs.length === 0) {
        console.error("❌ [PROXY] No active tab found for crypto operations");
        throw new Error("No active tab found for crypto operations");
      }

      console.log("✅ [PROXY] Found active tab:", tabs[0].id);
      console.log("📤 [PROXY] Sending operation to content script...");

      const response = (await browser.tabs.sendMessage(tabs[0].id!, {
        action: "HEDERA_PROXY",
        data: operationData,
      })) as any;

      console.log("📥 [PROXY] Received response from content script:", response);

      if (response && response.success) {
        console.log("✅ [PROXY] Operation successful:", response.result);
        return response.result;
      } else {
        console.error("❌ [PROXY] Operation failed:", response?.error);
        throw new Error(response?.error || "Failed to execute Hedera operation via proxy");
      }
    } catch (error) {
      console.error("❌ [PROXY] Proxy operation failed:", error);
      throw error;
    }
  }


  private async handleAudioRecording(message: any): Promise<any> {
    try {
      const subAction = message.subAction || message.data?.subAction;
      const data = message.data || message;

      if (!subAction) {
        return {
          success: false,
          error: `Missing subAction in audio recording message. Received: ${JSON.stringify(
            message
          )}`,
        };
      }

      switch (subAction) {
        case "START":
          return { success: true, message: "Audio recording started" };

        case "STOP":
          return { success: true, message: "Audio recording stopped" };

        case "CAPTURE_SEGMENT":
          if (data.audioData) {
            const activeSessions = await this.hederaAgent.getActiveSessions();
            const session = activeSessions.find((s) => s.isRecording);

            if (!session) {
              return {
                success: false,
                error: "No active recording session found for audio processing",
              };
            }

            if (!session.hcsTopicId) {
              return { success: false, error: "Session missing HCS topic ID" };
            }

            if (this.queuePaused) {
              return {
                success: false,
                error: "Queue is paused due to previous failure",
              };
            }

            if (data.sessionStartTime && data.startTimeMs !== undefined) {
              await this.processSynchronizedAudioChunk(data);
            } else {
              const queuedSegment: QueuedSegment = {
                sessionId: session.sessionId,
                audioData: data.audioData,
                startTimeMs: data.startTimeMs || 0,
                endTimeMs: data.endTimeMs || 5000,
                sequence: data.sequence || Date.now(),
                attempts: 0,
              };

              this.processingQueue.push(queuedSegment);
              this.processQueue();
            }

            return {
              success: true,
              message: "Audio segment added to queue",
              queueLength: this.processingQueue.length,
            };
          }
          return { success: false, error: "Missing audio data" };

        default:
          return {
            success: false,
            error: `Unknown audio recording sub-action: ${subAction}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Audio recording handling failed",
      };
    }
  }

  private async handleStartTrade(data: any): Promise<any> {
    try {
      const baseUrl =
        process.env.NODE_ENV === "development"
          ? "http://localhost:3000"
          : "https://crownie-demo.vercel.app";

      const swapUrl = `${baseUrl}/create-order?secretHash=${data.hashLock}&meetingId=${data.meetingId}`;

      const tab = await browser.tabs.create({
        url: swapUrl,
        active: true,
      });

      return {
        success: true,
        message: "Trade started",
        swapUrl,
        tabId: tab.id,
      };
    } catch (error) {
      throw error;
    }
  }

  private async handleStopTrade(): Promise<any> {
    try {
      const tabs = await browser.tabs.query({
        url: "*://crownie-demo.vercel.app/*",
      });

      for (const tab of tabs) {
        if (tab.id) {
          await browser.tabs.remove(tab.id);
        }
      }

      return { success: true, message: "Trade stopped" };
    } catch (error) {
      throw error;
    }
  }

  private async healthCheck(): Promise<any> {
    try {
      const isHealthy = await this.hederaAgent.healthCheck();
      const state = this.hederaAgent.getState();

      return {
        status: isHealthy ? "healthy" : "unhealthy",
        agent: state.status,
        network: state.config.network,
        timestamp: Date.now(),
        accountId: state.identity?.accountId,
        balance: state.identity
          ? await this.hederaAgent.getAccountBalance()
          : 0,
      };
    } catch (error) {
      return {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      };
    }
  }

  private async getAgentState(): Promise<any> {
    try {
      const state = this.hederaAgent.getState();
      const isReady = await this.hederaAgent.isAgentReady();

      return {
        ...state,
        isReady,
        backgroundInitialized: this.isInitialized,
      };
    } catch (error) {
      throw error;
    }
  }

  private async getAccountBalance(): Promise<any> {
    try {
      const balance = await this.hederaAgent.getAccountBalance();
      return {
        balance: balance.toString(),
        formatted: (balance / 100000000).toFixed(8) + " HBAR",
      };
    } catch (error) {
      throw error;
    }
  }

  private async saveMeetingSecret(data: {
    meetingId: string;
    secret: string;
    hashLock: string;
  }): Promise<any> {
    try {
      await StorageService.saveMeetingSecret(data.meetingId, data.secret);
      return { success: true, secret: data.secret };
    } catch (error) {
      throw error;
    }
  }

  private async getMeetingSecret(data: { meetingId: string }): Promise<any> {
    try {
      const secret = await StorageService.getMeetingSecret(data.meetingId);

      if (secret) {
        return { success: true, secret };
      } else {
        return { success: false, error: "No secret found" };
      }
    } catch (error) {
      throw error;
    }
  }

  private async importAccount(data: {
    privateKey: string;
    accountId: string;
    network?: "testnet" | "mainnet";
    openaiApiKey?: string;
  }): Promise<any> {
    try {
      if (data.openaiApiKey) {
        await StorageService.saveOpenAIApiKey(data.openaiApiKey);
      }

      const result = await this.hederaAgent.importAccount(
        data.privateKey,
        data.accountId,
        data.network || "testnet"
      );

      if (result.status === "active") {
        this.isInitialized = true;
      } else {
        if (result.errorMessage) {
        }
      }

      return {
        success: true,
        state: result,
      };
    } catch (error) {
      console.error("Account import failed:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to import account",
      };
    }
  }

  private async reinitializeAgent(): Promise<any> {
    try {
      await this.initializeAgentIfReady();
      return { success: true, message: "Agent reinitialized" };
    } catch (error) {
      console.error("Failed to reinitialize agent:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to reinitialize agent",
      };
    }
  }

  private async openPopup(): Promise<any> {
    try {
      await browser.action.openPopup();
      return { success: true };
    } catch (error) {
      return { success: false, error: "Could not open popup" };
    }
  }

  private async testCrypto(): Promise<any> {
    try {
      if (!globalThis.crypto || !globalThis.crypto.subtle) {
        return { success: false, error: "Crypto.subtle not available" };
      }

      const testData = new TextEncoder().encode("Hello, World!");
      const hash = await globalThis.crypto.subtle.digest("SHA-256", testData);

      return {
        success: true,
        message: "Crypto polyfill test successful!",
        details: {
          cryptoAvailable: !!globalThis.crypto,
          subtleAvailable: !!globalThis.crypto.subtle,
          digestLength: hash.byteLength,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          "Crypto polyfill test failed: " +
          (error instanceof Error ? error.message : "Unknown error"),
      };
    }
  }

  private async getMeetingSessions(): Promise<any> {
    try {
      const sessions = await this.hederaAgent.getActiveSessions();
      return {
        success: true,
        sessions: sessions,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get meeting sessions",
      };
    }
  }

  private async resetQueue(): Promise<any> {
    try {
      this.queuePaused = false;
      this.processingQueue = [];
      this.isProcessingQueue = false;
      return { success: true, message: "Queue reset" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reset queue",
      };
    }
  }

  private async processQueue(): Promise<void> {
    if (
      this.isProcessingQueue ||
      this.processingQueue.length === 0 ||
      this.queuePaused
    ) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.processingQueue.length > 0 && !this.queuePaused) {
      const segment = this.processingQueue.shift()!;

      try {
        const activeSessions = await this.hederaAgent.getActiveSessions();
        const session = activeSessions.find(
          (s) => s.sessionId === segment.sessionId
        );

        if (!session || !session.isRecording) {
          continue;
        }

        const transcription = await this.transcriptionService.transcribeAudio(
          segment.audioData
        );

        if (transcription.success && transcription.text) {
          const transcriptionMessage = JSON.stringify({
            type: 'transcription',
            meetingId: session.meetingInfo.meetingId,
            segment: {
              text: transcription.text,
              startTime: segment.startTimeMs,
              endTime: segment.endTimeMs,
              confidence: transcription.confidence || 0.95
            },
            timestamp: Date.now()
          });

          try {
            await this.proxyHederaOperation({
              operation: 'SUBMIT_MESSAGE',
              topicId: session.hcsTopicId,
              message: transcriptionMessage
            });
          } catch (error) {
            console.error(`Failed to submit transcription message: ${error}`);
            throw error;
          }
        } else {
          if (
            transcription.error &&
            transcription.error.includes("too small or empty")
          ) {
            console.log(
              `Segment ${segment.sequence} skipped - likely silent segment`
            );
            continue;
          }
          throw new Error(transcription.error || "Transcription failed");
        }
      } catch (error) {
        console.error(`Segment ${segment.sequence} failed:`, error);

        const errorMessage = error instanceof Error ? error.message : "";
        const isFormatError =
          errorMessage.includes("Invalid file format") ||
          errorMessage.includes("too small or empty");

        if (isFormatError) {
          console.log(
            `Segment ${segment.sequence} skipped - audio format/size issue`
          );
          continue; 
        }

        segment.attempts++;
        if (segment.attempts < 3) {
          this.processingQueue.unshift(segment);
        } else {
          console.error(
            `Max retries reached for segment ${segment.sequence}. Pausing queue.`
          );
          this.queuePaused = true;
          this.processingQueue.unshift(segment);
          break;
        }
      }
    }

    this.isProcessingQueue = false;
  }

  private async getTopicMessages(data: { topicId?: string, meetingId?: string }): Promise<any> {
    try {
      let targetTopicId = data.topicId;
      
      if (!targetTopicId && data.meetingId) {
        const meetingTopic = await StorageService.getMeetingTopic(data.meetingId);
        if (meetingTopic) {
          targetTopicId = meetingTopic;
        }
      }
      
      if (!targetTopicId) {
        targetTopicId = "0.0.6534435";
      }
      const mirrorNodeUrl = `https://testnet.mirrornode.hedera.com/api/v1/topics/${targetTopicId}/messages?limit=50&order=desc`;

      const response = await fetch(mirrorNodeUrl);
      if (!response.ok) {
        throw new Error(`Mirror node request failed: ${response.status}`);
      }

      const apiResponse = await response.json();

      if (apiResponse.messages && apiResponse.messages.length > 0) {
        const processedMessages = apiResponse.messages.map((msg: any) => {
          let decodedMessage = "";

          if (msg.message && msg.message.trim()) {
            try {
              decodedMessage = atob(msg.message);
            } catch (decodeError) {
              decodedMessage = msg.message;
            }
          }

          return {
            ...msg,
            message: decodedMessage,
            consensus_timestamp: msg.consensus_timestamp,
          };
        });

        return {
          success: true,
          topicId: targetTopicId,
          messages: processedMessages,
          hashscanUrl: `https://hashscan.io/testnet/topic/${targetTopicId}/messages`,
        };
      }

      return {
        success: true,
        topicId: targetTopicId,
        messages: [],
        hashscanUrl: `https://hashscan.io/testnet/topic/${targetTopicId}/messages`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async generateSummary(data: { messages?: any[] }): Promise<any> {
    try {
      if (!data.messages || data.messages.length === 0) {
        return {
          success: false,
          error: "No messages provided for summary generation",
        };
      }

      const transcriptionMessages = data.messages
        .filter((msg: any) => {
          try {
            const parsed = typeof msg === "string" ? JSON.parse(msg) : msg;
            return parsed.type === "transcription" && parsed.segment?.text;
          } catch {
            return false;
          }
        })
        .map((msg: any) => {
          const parsed = typeof msg === "string" ? JSON.parse(msg) : msg;
          return {
            text: parsed.segment.text,
            timestamp: parsed.timestamp,
            meetingId: parsed.meetingId,
          };
        });

      if (transcriptionMessages.length === 0) {
        return {
          success: false,
          error: "No transcription messages found",
        };
      }

      const fullTranscript = transcriptionMessages
        .map((msg) => msg.text)
        .join(" ");
      const meetingStartTime = new Date(
        Math.min(...transcriptionMessages.map((msg) => msg.timestamp))
      );
      const meetingEndTime = new Date(
        Math.max(...transcriptionMessages.map((msg) => msg.timestamp))
      );
      const meetingId = transcriptionMessages[0].meetingId;

      const summaryPrompt = `Please analyze this meeting transcript and provide a comprehensive summary:

Meeting Details:
- Date: ${meetingStartTime.toLocaleDateString()}
- Start Time: ${meetingStartTime.toLocaleTimeString()}
- End Time: ${meetingEndTime.toLocaleTimeString()}
- Meeting ID: ${meetingId}

Transcript:
${fullTranscript}

Please provide a well-structured markdown summary with:
1. Main topics discussed
2. Key decisions made
3. Action items (if any)
4. Important insights
5. Overall meeting outcome

Use proper markdown formatting with headers, bullet points, and emphasis where appropriate.`;

      const response = await fetch(
        "https://us-central1-blueband-db-442d8.cloudfunctions.net/proxy",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            endpoint: "/v1/chat/completions",
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: summaryPrompt,
              },
            ],
            max_tokens: 1000,
            temperature: 0.3,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Summary generation failed: ${response.status}`);
      }

      const result = await response.json();
      const summary = result.choices?.[0]?.message?.content;

      if (!summary) {
        throw new Error("No summary generated");
      }

      console.log("✅ Summary generated successfully");
      return {
        success: true,
        summary: summary,
        segmentCount: transcriptionMessages.length,
        transcriptLength: fullTranscript.length,
      };
    } catch (error) {
      console.error("❌ Failed to generate summary:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async startTabCapture(): Promise<any> {
    try {
      if (this.tabCaptureStream) {
        return { success: false, error: 'Tab capture already active' };
      }

              if (!chrome.tabCapture || typeof chrome.tabCapture.capture !== 'function') {
          console.error('🎵 chrome.tabCapture.capture is not available');
          return { success: false, error: 'Tab capture API not available' };
        }

      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new Error('No active tab found');
      }

      const stream = await new Promise<MediaStream>((resolve, reject) => {
        chrome.tabCapture.capture(
          { audio: true, video: false },
          (captureStream) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!captureStream) {
              reject(new Error('No capture stream received'));
            } else {
              resolve(captureStream);
            }
          }
        );
      });

      this.tabCaptureStream = stream;
      
      this.tabMediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      this.tabAudioChunks = [];
      
      this.tabMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.tabAudioChunks.push(event.data);
          this.processTabAudioChunk(event.data);
        }
      };
      
      this.tabMediaRecorder.start(30000);
      
      stream.getAudioTracks().forEach(track => {
        track.onended = () => {
          this.stopTabCapture();
        };
      });
      
      return { 
        success: true, 
        message: 'Tab audio capture started',
        streamId: stream.id 
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Tab capture failed' 
      };
    }
  }

  private async stopTabCapture(): Promise<any> {
    try {
      if (this.tabMediaRecorder && this.tabMediaRecorder.state === 'recording') {
        this.tabMediaRecorder.stop();
      }
      
      if (this.tabCaptureStream) {
        this.tabCaptureStream.getAudioTracks().forEach(track => {
          track.stop();
        });
        this.tabCaptureStream = null;
      }
      
      this.tabMediaRecorder = null;
      this.tabAudioChunks = [];
      
      return { 
        success: true, 
        message: 'Tab audio capture stopped' 
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to stop tab capture' 
      };
    }
  }

  private async processTabAudioChunk(audioBlob: Blob): Promise<void> {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      );
      
      const activeSessions = await this.hederaAgent.getActiveSessions();
      const session = activeSessions.find(s => s.isRecording);
      
      if (!session) {
        return;
      }
      
      const queuedSegment: QueuedSegment = {
        sessionId: session.sessionId,
        audioData: base64Audio,
        startTimeMs: Date.now() - 30000,
        endTimeMs: Date.now(),
        sequence: Date.now(),
        attempts: 0,
      };
      
      this.processingQueue.push(queuedSegment);
      this.processQueue();
      
    } catch (error) {
      console.error('Failed to process tab audio chunk:', error);
    }
  }

  private async processSynchronizedAudioChunk(data: any): Promise<void> {
    try {
      const activeSessions = await this.hederaAgent.getActiveSessions();
      const session = activeSessions.find(s => s.isRecording);
      
      if (!session) {
        return;
      }
      
      const queuedSegment: QueuedSegment = {
        sessionId: session.sessionId,
        audioData: data.audioData,
        startTimeMs: data.sessionStartTime + data.startTimeMs,
        endTimeMs: data.sessionStartTime + data.endTimeMs,
        sequence: data.sequence,
        attempts: 0,
      };
      
      this.processingQueue.push(queuedSegment);
      this.processQueue();
      
    } catch (error) {
      console.error('Failed to process synchronized audio chunk:', error);
    }
  }

  private async requestScreenCapture(): Promise<{success: boolean, streamId?: string, error?: string}> {
    return new Promise(async (resolve) => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
          resolve({ success: false, error: 'No active tab found' });
          return;
        }
        
        const activeTab = tabs[0];
        if (!activeTab.id) {
          resolve({ success: false, error: 'Active tab has no ID' });
          return;
        }

        console.log('Requesting screen capture for tab:', activeTab.id);
        
        chrome.desktopCapture.chooseDesktopMedia(
          ['screen', 'window', 'tab', 'audio'],
          activeTab,
          (streamId: string) => {
            if (streamId) {
              console.log('Screen capture stream ID obtained:', streamId);
              resolve({ success: true, streamId });
            } else {
              console.log('Screen capture cancelled by user');
              resolve({ success: false, error: 'User cancelled screen capture' });
            }
          }
        );
      } catch (error) {
        console.error('Error requesting screen capture:', error);
        resolve({ success: false, error: (error as Error).message || 'Failed to request screen capture' });
      }
    });
  }

  private async requestTabCapture(): Promise<{success: boolean, error?: string}> {
    return new Promise(async (resolve) => {
      try {
        if (!chrome.tabCapture || typeof chrome.tabCapture.capture !== 'function') {
          console.error('🎵 chrome.tabCapture.capture is not available');
          resolve({ success: false, error: 'Tab capture API not available' });
          return;
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
          resolve({ success: false, error: 'No active tab found' });
          return;
        }
        
        const activeTab = tabs[0];
        if (!activeTab.id) {
          resolve({ success: false, error: 'Active tab has no ID' });
          return;
        }

        console.log('🎵 Requesting tab capture for tab:', activeTab.id);
        
        chrome.tabCapture.capture(
          {
            audio: true,
            video: false
          },
          (stream: MediaStream | null) => {
            if (chrome.runtime.lastError) {
              console.error('🎵 Tab capture failed:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message || 'Tab capture failed' });
              return;
            }
            
            if (stream) {
              console.log('🎵 Tab capture stream obtained:', stream);
              const audioTracks = stream.getAudioTracks();
              console.log('🎵 Audio tracks:', audioTracks);
              
              if (audioTracks.length === 0) {
                resolve({ success: false, error: 'No audio tracks available in tab capture' });
                return;
              }

              this.tabCaptureStream = stream;
              this.startTabAudioRecording(stream);
              
              resolve({ success: true });
            } else {
              console.log('🎵 Tab capture cancelled or failed');
              resolve({ success: false, error: 'Tab capture cancelled or failed' });
            }
          }
        );
      } catch (error) {
        console.error('🎵 Error requesting tab capture:', error);
        resolve({ success: false, error: (error as Error).message || 'Failed to request tab capture' });
      }
    });
  }

  private startTabAudioRecording(stream: MediaStream) {
    try {
      console.log('🎵 Starting tab audio recording...');
      
      this.tabMediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.tabMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.processTabAudioChunk(event.data);
        }
      };

      this.tabMediaRecorder.onerror = (event) => {
        console.error('🎵 Tab MediaRecorder error:', event);
      };

              this.tabMediaRecorder.start(30000);
        console.log('🎵 Tab audio recording started successfully');
      
    } catch (error) {
      console.error('🎵 Failed to start tab audio recording:', error);
    }
  }

}

try {
  new CrownieHederaBackground();
} catch (error) {
  console.error("background err:", error);
}

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
  }
});
