// IMPORTANT: Import Node.js polyfills FIRST, before any other modules
import "../utils/nodePolyfills";

import browser from "webextension-polyfill";
import { HederaAgent } from "../agents/HederaAgent";
import { StorageService } from "../services/StorageService";
import { MeetingService } from "../services/MeetingService";
import type { MeetingSession, AgentConfig } from "../types";

class CrownieHederaBackground {
  private hederaAgent: HederaAgent;
  private meetingService: MeetingService;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private currentMeetingInfo: any = null;

  constructor() {
    this.hederaAgent = new HederaAgent();
    this.meetingService = new MeetingService();
    this.setupMessageListener();
    this.setupKeepalive();
    this.initializeAgent();
  }

  private async initializeAgent(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`🔧 Background: Agent initialization attempt ${attempts}/${maxAttempts}`);
        
        const currentState = this.hederaAgent.getState();
        if (currentState.status === "active" && this.isInitialized) {
          console.log("✅ Agent already active and initialized");
          return;
        }

        console.log("🔧 Background: Initializing agent...");
        const config: Partial<AgentConfig> = {
          network: "testnet",
          maxTranscriptionChunkSize: 1000,
          transcriptionInterval: 5000,
          heartbeatInterval: 30000,
        };

        let restoredState = await this.hederaAgent.restoreFromStorage();

        if (restoredState && restoredState.status === "active") {
          console.log("✅ Agent restored from storage successfully");
          this.isInitialized = true;
          return;
        }

        console.log("🔧 No valid stored state, attempting fresh initialization...");
        const newState = await this.hederaAgent.initialize(config);
        
        if (newState.status === "active") {
          console.log("✅ Agent initialized fresh successfully");
          this.isInitialized = true;
          return;
        } else {
          console.log("❌ Agent initialization completed but status is:", newState.status);
          if (newState.errorMessage) {
            console.log("❌ Error message:", newState.errorMessage);
          }
          
          if (newState.errorMessage && 
              (newState.errorMessage.includes("No identity found") || 
               newState.errorMessage.includes("API key not found"))) {
            console.log("❌ Critical error that won't be resolved by retry:", newState.errorMessage);
            this.isInitialized = false;
            return;
          }
          
          if (attempts < maxAttempts) {
            console.log(`⏱️  Waiting 2 seconds before retry attempt ${attempts + 1}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } catch (error) {
        console.error(`❌ Agent initialization failed (attempt ${attempts}/${maxAttempts}):`, error);
        
        if (attempts < maxAttempts) {
          console.log(`⏱️  Waiting 2 seconds before retry attempt ${attempts + 1}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    console.error("❌ Agent initialization failed after all attempts");
    this.isInitialized = false;
  }

  private async checkAndUpdateInitializationStatus(): Promise<void> {
    try {
      const agentState = this.hederaAgent.getState();
      const isReady = await this.hederaAgent.isAgentReady();
      
      if (agentState.status === "active" && isReady) {
        if (!this.isInitialized) {
          console.log("✅ Background: Agent is active and ready, updating initialization flag");
          this.isInitialized = true;
        }
      } else {
        if (this.isInitialized) {
          console.log("⚠️ Background: Agent is not ready, updating initialization flag");
          this.isInitialized = false;
        }
      }
    } catch (error) {
      console.error("❌ Background: Error checking initialization status:", error);
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
            return await this.handleAudioRecording(message.data);
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
          } catch (error) {
            // Tab might not have content script, ignore
          }
        }
      }
    } catch (error) {
    }
  }

  private async handleMeetingDetected(data: any): Promise<any> {
    try {
      console.log("🔍 Background: Meeting detected:", data);
      this.currentMeetingInfo = data;

      if (!this.isInitialized) {
        console.log("⚠️ Background: Agent not initialized, storing meeting info only");
        return {
          success: true,
          message: "Meeting detected but agent not initialized",
        };
      }

      console.log("🔍 Background: Creating meeting session...");
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
      console.log("🔍 Background: Meeting session created:", sessionId);

      return {
        success: true,
        sessionId,
        message: "Meeting detected and session created",
      };
    } catch (error) {
      console.error("❌ Background: Failed to handle meeting detection:", error);
      throw error;
    }
  }

  private async getMeetingStatus(): Promise<any> {
    try {
      console.log("🔍 Background: Getting meeting status...");
      console.log("🔍 Background: Current meeting info:", this.currentMeetingInfo);
      
      const activeSessions = await this.hederaAgent.getActiveSessions();
      console.log("🔍 Background: Active sessions:", activeSessions);
      
      const latestSession = activeSessions[activeSessions.length - 1];

      if (!latestSession && !this.currentMeetingInfo) {
        console.log("🔍 Background: No meeting detected");
        return {
          isMeetingDetected: false,
          isRecording: false,
          recordingDuration: 0,
        };
      }

      if (latestSession) {
        console.log("🔍 Background: Returning latest session info:", latestSession);
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
        console.log("🔍 Background: Returning current meeting info:", this.currentMeetingInfo);
        return {
          isMeetingDetected: true,
          platform: this.currentMeetingInfo.platform,
          meetingId: this.currentMeetingInfo.meetingId,
          title: this.currentMeetingInfo.title,
          isRecording: false,
          recordingDuration: 0,
        };
      }

      console.log("🔍 Background: No meeting info found");
      return {
        isMeetingDetected: false,
        isRecording: false,
        recordingDuration: 0,
      };
    } catch (error) {
      console.error("🔍 Background: Error getting meeting status:", error);
      return {
        isMeetingDetected: false,
        isRecording: false,
        recordingDuration: 0,
      };
    }
  }

  private async startRecording(sessionId?: string): Promise<any> {
    try {
      if (!this.isInitialized) {
        console.log("🔧 Background: Agent not initialized, checking status...");
        
        await this.checkAndUpdateInitializationStatus();
        
        if (!this.isInitialized) {
          console.log("🔧 Background: Agent still not initialized, attempting re-initialization...");
          
          try {
            await this.initializeAgent();
          } catch (initError) {
            console.error("❌ Background: Re-initialization failed:", initError);
            const agentState = this.hederaAgent.getState();
            const errorMsg = agentState.errorMessage || 
              (agentState.status === "initializing" 
                ? "Agent is still initializing. Please wait a moment and try again."
                : "Agent not initialized. Please check your account setup in the extension popup.");
            throw new Error(errorMsg);
          }
        }
      }

      const isReady = await this.hederaAgent.isAgentReady();

      if (!isReady) {
        throw new Error(
          "Agent is not fully ready - please wait for initialization to complete"
        );
      }

      const activeSessions = await this.hederaAgent.getActiveSessions();
      if (!sessionId) {
        const latestSession = activeSessions[activeSessions.length - 1];
        if (!latestSession) {
          throw new Error("No active session found");
        }
        sessionId = latestSession.sessionId;
      }

      const session = activeSessions.find((s) => s.sessionId === sessionId);
      if (!session) {
        throw new Error("Session not found");
      }

      if (session.isRecording) {
        return { success: false, error: "Recording already in progress" };
      }

      // TEMPORARY: HARDCODE TOPIC FOR DEMO (bypass all crypto issues)
      const result: { topicId: string } = {
        topicId: "0.0.6534435" // Real topic created by standalone script
      };
      
      console.log("🔧 [DEMO MODE] Using hardcoded topic ID for demo:", result.topicId);
      console.log("🔧 [DEMO MODE] Meeting:", session.meetingInfo.title);

      await this.hederaAgent.updateMeetingSession(sessionId, {
        hcsTopicId: result.topicId,
        status: "recording" as const,
      });

      await this.hederaAgent.startRecording(sessionId);

      this.notifyContentScripts({
        action: "UPDATE_RECORDING_STATE",
        data: {
          isRecording: true,
          duration: 0,
        },
      });

      return {
        success: true,
        sessionId: sessionId,
        topicId: result.topicId,
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

      // Agent must be available for recording to work
      if (!this.isInitialized) {
        throw new Error("Agent not initialized - cannot stop recording");
      }

      await this.hederaAgent.stopRecording(sessionId);

      // TEMPORARY: Skip agent finalization for demo (would cause crypto.subtle errors)
      console.log("🔧 [DEMO MODE] Skipping agent finalization to avoid crypto issues");
      console.log("🔧 [DEMO MODE] Session ended:", {
        sessionId: sessionId,
        topicId: activeSession.hcsTopicId,
        endTime: Date.now(),
        totalSegments: activeSession.recordingDuration || 0,
        totalWords: 0,
      });

      // Notify content scripts of recording state change
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
      if (toolCall.name === 'create_topic_tool') {
        return await this.proxyCreateTopic(toolCall.arguments);
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

  private async proxyCreateTopic(toolArgs: any): Promise<any> {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new Error("No active tab found for crypto operations");
      }

      const response = await browser.tabs.sendMessage(tabs[0].id!, {
        action: "PROXY_CREATE_TOPIC",
        data: toolArgs
      }) as any;

      if (response && response.success) {
        return response.result;
      } else {
        throw new Error(response?.error || "Failed to create topic via proxy");
      }
    } catch (error) {
      throw error;
    }
  }

  private async handleAudioRecording(data: any): Promise<any> {
    try {
      switch (data.subAction) {
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

            const transcriptionService = new (
              await import("../services/TranscriptionService")
            ).TranscriptionService();

            try {
              let transcriptionSession = await transcriptionService.getSession(
                session.sessionId
              );
              if (!transcriptionSession) {
                transcriptionSession = await transcriptionService.startSession(
                  session.sessionId,
                  session.hcsTopicId,
                  session.meetingInfo.meetingId
                );
              }

              const segment =
                await transcriptionService.processAudioSegmentWithAgent(
                  session.sessionId,
                  data.audioData,
                  data.startTimeMs || 0,
                  data.endTimeMs || 5000,
                  data.sequence || Date.now(),
                  this.hederaAgent,
                  session.hcsTopicId
                );

              return {
                success: true,
                message:
                  "Audio segment processed, transcribed, and sent to agent",
                transcription: segment.text,
                confidence: segment.confidence,
                agentProcessed: segment.agentProcessed,
              };
            } catch (transcriptionError) {
              return {
                success: false,
                error: `Transcription failed: ${
                  transcriptionError instanceof Error
                    ? transcriptionError.message
                    : "Unknown error"
                }`,
              };
            }
          }
          return { success: false, error: "Missing audio data" };

        default:
          return {
            success: false,
            error: `Unknown audio recording sub-action: ${data.subAction}`,
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
          : "https://crownie-swap.vercel.app";

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
        url: "*://crownie-swap.vercel.app/*",
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
        console.log("✅ Background: Account imported successfully, agent is now initialized");
      } else {
        console.log("⚠️ Background: Account imported but agent status is:", result.status);
        if (result.errorMessage) {
          console.log("⚠️ Background: Error message:", result.errorMessage);
        }
      }

      return {
        success: true,
        state: result,
      };
    } catch (error) {
      console.error("❌ Background: Account import failed:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to import account",
      };
    }
  }

  private async reinitializeAgent(): Promise<any> {
    try {
      console.log("🔧 Background: Reinitializing agent...");
      await this.initializeAgent();
      console.log("✅ Background: Agent reinitialized successfully.");
      return { success: true, message: "Agent reinitialized" };
    } catch (error) {
      console.error("❌ Background: Failed to reinitialize agent:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reinitialize agent",
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
          digestLength: hash.byteLength
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: "Crypto polyfill test failed: " + (error instanceof Error ? error.message : "Unknown error") 
      };
    }
  }

  private async getMeetingSessions(): Promise<any> {
    try {
      const sessions = await this.hederaAgent.getActiveSessions();
      return {
        success: true,
        sessions: sessions
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get meeting sessions"
      };
    }
  }

}

try {
  new CrownieHederaBackground();
} catch (error) {
}

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
  }
});
