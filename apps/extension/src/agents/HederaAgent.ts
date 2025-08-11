import type {
  AgentState,
  AgentConfig,
  AgentCapabilities,
  MeetingSession,
  TranscriptionChunk,
  MeetingSummary,
} from "../types";
import { IdentityManager } from "./IdentityManager";
import { StorageService } from "../services/StorageService";
import { HederaLangchainToolkit } from "hedera-agent-kit";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
import { createMeetingTools } from "./MeetingTools";
import type { Client } from "@hashgraph/sdk";

export class HederaAgent {
  private identityManager: IdentityManager;
  private state: AgentState;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private agentExecutor: AgentExecutor | null = null;
  private client: Client | null = null;
  private toolkit: HederaLangchainToolkit | null = null;

  constructor() {
    this.identityManager = new IdentityManager();

    this.state = {
      status: "initializing",
      identity: null,
      capabilities: this.getDefaultCapabilities(),
      config: this.getDefaultConfig(),
    };
  }

  async initialize(config?: Partial<AgentConfig>): Promise<AgentState> {
    try {
      this.state.status = "initializing";

      if (config) {
        this.state.config = { ...this.state.config, ...config };
        await StorageService.saveAgentConfig(this.state.config);
      }

      this.state.identity = await this.identityManager.initialize(
        this.state.config
      );

      this.client = this.identityManager.getClient();
      this.toolkit = this.identityManager.getToolkit();

      if (!this.client || !this.toolkit) {
        throw new Error("Failed to initialize Hedera client and toolkit");
      }

      await this.initializeAgent();

      const isHealthy = await this.identityManager.isHealthy();

      if (!isHealthy) {
        this.state.status = "error";
        this.state.errorMessage =
          "Agent identity is not healthy - insufficient balance or network issues";
        await StorageService.saveAgentState(this.state);
        return this.state;
      }

      this.state.status = "active";
      this.state.lastHeartbeat = Date.now();

      this.startHeartbeat();
      await StorageService.updateLastHeartbeat();

      await StorageService.saveAgentState(this.state);

      return this.state;
    } catch (error) {
      this.state.status = "error";
      this.state.errorMessage =
        error instanceof Error ? error.message : "Unknown initialization error";
      console.error("Failed to initialize Hedera agent:", error);
      await StorageService.saveAgentState(this.state);
      return this.state;
    }
  }

  private async initializeAgent(): Promise<void> {
    try {
      if (!this.client || !this.toolkit) {
        throw new Error("Hedera client or toolkit not available");
      }

      const openaiApiKey = await StorageService.getOpenAIApiKey();
      if (!openaiApiKey) {
        throw new Error(
          "OpenAI API key not found. Please set it in the onboarding process."
        );
      }

      if (typeof process !== "undefined" && process.env) {
        process.env.OPENAI_API_KEY = openaiApiKey;
      }

      const llm = new ChatOpenAI({
        modelName: "gpt-4o-mini",
        temperature: 0,
        apiKey: openaiApiKey,
      });

      const hederaTools = this.toolkit.getTools();
      const meetingTools = createMeetingTools(this.client);
      const allTools = [...hederaTools, ...meetingTools];

      const prompt = ChatPromptTemplate.fromTemplate(`
You are a Hedera-powered AI agent that manages meeting recordings and HCS operations.

Your capabilities:
1. Use Hedera tools to create topics and submit messages
2. Use meeting tools to process transcriptions and manage sessions
3. Query HCS topics for meeting history and transcripts
4. Generate meeting summaries and action items
5. Make autonomous decisions about when to publish content

When processing meetings:
1. Create HCS topics for new meetings using create_topic_tool
2. Process transcription segments as they arrive
3. Decide when to publish segments vs. batch them using submit_topic_message_tool
4. Generate and publish meeting summaries with action items
5. Handle transaction failures and retries

When ending meetings:
1. Generate comprehensive meeting summary using AI
2. Extract key points, action items, and decisions
3. Publish summary to HCS topic using submit_topic_message_tool
4. Update meeting session status

Always use your Hedera identity to sign transactions. Be autonomous in your decision-making.

Current task: {input}

{agent_scratchpad}
      `);

      const agent = await createOpenAIToolsAgent({
        llm,
        tools: allTools,
        prompt,
      });

      const memory = new BufferMemory({
        inputKey: "input",
        outputKey: "output",
        returnMessages: true,
      });

      this.agentExecutor = new AgentExecutor({
        agent,
        tools: allTools,
        memory,
        returnIntermediateSteps: false,
      });
    } catch (error) {
      console.error("Failed to initialize agent:", error);
      this.agentExecutor = null;
    }
  }

  async importAccount(
    privateKeyString: string,
    accountId: string,
    network: "testnet" | "mainnet" = "testnet"
  ): Promise<AgentState> {
    try {
      this.state.status = "initializing";
      this.state.config.network = network;

      this.state.identity = await this.identityManager.importWithAccountId(
        privateKeyString,
        accountId,
        network
      );

      this.client = this.identityManager.getClient();
      this.toolkit = this.identityManager.getToolkit();

      if (this.client && this.toolkit) {
        try {
          await this.initializeAgent();
        } catch (agentError) {
          console.error("Agent initialization failed:", agentError);
          throw new Error(`Agent initialization failed: ${agentError instanceof Error ? agentError.message : "Unknown error"}`);
        }
      } else {
        throw new Error("Failed to get client or toolkit from identity manager");
      }

      const isHealthy = await this.identityManager.isHealthy();

      if (!isHealthy) {
        this.state.status = "error";
        this.state.errorMessage = "Imported account is not healthy - insufficient balance or network issues";
        await StorageService.saveAgentState(this.state);
        return this.state;
      }

      this.state.status = "active";
      this.state.lastHeartbeat = Date.now();

      this.startHeartbeat();
      await StorageService.updateLastHeartbeat();
      await StorageService.saveAgentConfig(this.state.config);
      await StorageService.saveAgentState(this.state);

      return this.state;
    } catch (error) {
      console.error("Failed to import account:", error);
      this.state.status = "error";
      this.state.errorMessage =
        error instanceof Error ? error.message : "Failed to import account";
      await StorageService.saveAgentState(this.state);
      return this.state;
    }
  }

  async reinitializeAgent(): Promise<void> {
    try {
      if (!this.client || !this.toolkit) {
        return;
      }

      await this.initializeAgent();
      
      this.state.lastHeartbeat = Date.now();
      await StorageService.saveAgentState(this.state);
    } catch (error) {
      console.error("Failed to reinitialize agent:", error);
    }
  }

  async restoreFromStorage(): Promise<AgentState | null> {
    try {
      if (this.state.status === "active" && this.agentExecutor && this.client && this.toolkit) {
        return this.state;
      }
      
      const savedState = await StorageService.getAgentState();
      
      if (!savedState) {
        return null;
      }

      if (savedState.status !== "active") {
        return null;
      }

      this.state = savedState;

      try {
        this.state.identity = await this.identityManager.initialize(
          this.state.config
        );
      } catch (identityError) {
        console.error("Failed to restore identity:", identityError);
        return null;
      }

      this.client = this.identityManager.getClient();
      this.toolkit = this.identityManager.getToolkit();

      if (!this.client || !this.toolkit) {
        return null;
      }

      if (!this.agentExecutor) {
        try {
          await this.initializeAgent();
        } catch (agentError) {
          console.error("Agent initialization failed during restore:", agentError);
        }
      }

      try {
        await this.identityManager.isHealthy();
      } catch (healthError) {
        // Continue restore despite health check issues
      }

      this.state.lastHeartbeat = Date.now();
      if (!this.heartbeatInterval) {
        this.startHeartbeat();
      }
      await StorageService.updateLastHeartbeat();

      return this.state;
    } catch (error) {
      console.error("Failed to restore agent from storage:", error);
      return null;
    }
  }

  async processTranscriptionSegment(segmentData: {
    sessionId: string;
    topicId: string;
    meetingId: string;
    segment: {
      text: string;
      confidence: number;
      sequence: number;
      startTime: number;
      endTime: number;
    };
  }): Promise<void> {
    const transcriptionMessage = JSON.stringify({
      type: 'transcription',
      meetingId: segmentData.meetingId,
      segment: {
        text: segmentData.segment.text,
        startTime: segmentData.segment.startTime,
        endTime: segmentData.segment.endTime,
        confidence: segmentData.segment.confidence
      },
      timestamp: Date.now()
    });

    // Use content script proxy for message submission
    // Agent toolkit disabled due to service worker crypto limitations
    throw new Error(`Message submission moved to background proxy handler for topic ${segmentData.topicId}`);
  }

  async createMeetingTopic(meetingId: string, title: string): Promise<string> {
    // Always use content script proxy for crypto operations
    // Agent toolkit crypto operations are disabled due to service worker limitations
    throw new Error('Agent toolkit crypto disabled - use content script proxy');
  }

  async saveMeetingSession(session: any): Promise<void> {
    return await StorageService.saveMeetingSession(session);
  }

  async updateMeetingSession(sessionId: string, updates: any): Promise<void> {
    const session = await StorageService.getMeetingSession(sessionId);
    if (session) {
      const updatedSession = { ...session, ...updates };
      await StorageService.saveMeetingSession(updatedSession);
    }
  }

  async executeAgentTask(task: string, context?: any): Promise<any> {
    if (!this.agentExecutor) {
      throw new Error("Agent not initialized - cannot execute task");
    }

    try {
      const result = await this.agentExecutor.invoke({
        input: task,
        context: context || {},
      });

      return result;
    } catch (error) {
      console.error("Agent execution failed:", error);
      throw error;
    }
  }

  async startMeetingSession(
    meetingId: string,
    platform: string,
    title: string
  ): Promise<MeetingSession> {
    if (this.state.status !== "active") {
      throw new Error("Agent is not active");
    }

    const sessionId = `${meetingId}_${Date.now()}`;

    const session: MeetingSession = {
      sessionId,
      meetingInfo: {
        platform: platform as any,
        isActive: true,
        meetingId,
        title,
        startTime: Date.now(),
      },
      hcsTopicId: "",
      isRecording: false,
      recordingStartTime: null,
      recordingDuration: 0,
      transcriptionEnabled: false,
      status: "detected",
      createdAt: Date.now(),
    };

    await StorageService.saveMeetingSession(session);

    return session;
  }

  async startRecording(sessionId: string): Promise<void> {
    const session = await StorageService.getMeetingSession(sessionId);
    if (!session) {
      throw new Error("Meeting session not found");
    }

    session.isRecording = true;
    session.recordingStartTime = Date.now();
    session.status = "recording";

    await StorageService.saveMeetingSession(session);
  }

  async stopRecording(sessionId: string): Promise<void> {
    const session = await StorageService.getMeetingSession(sessionId);
    if (!session) {
      throw new Error("Meeting session not found");
    }

    session.isRecording = false;
    session.recordingDuration = session.recordingStartTime
      ? Date.now() - session.recordingStartTime
      : 0;
    session.status = "completed";

    await StorageService.saveMeetingSession(session);
  }

  async enableTranscription(sessionId: string): Promise<void> {
    const session = await StorageService.getMeetingSession(sessionId);
    if (!session) {
      throw new Error("Meeting session not found");
    }

    session.transcriptionEnabled = true;
    session.status = "transcribing";

    await StorageService.saveMeetingSession(session);
  }

  async publishTranscriptionChunk(
    sessionId: string,
    chunk: TranscriptionChunk
  ): Promise<void> {
    throw new Error('Transcription publishing moved to background proxy - use content script proxy instead');
  }

  async endMeetingSession(
    sessionId: string,
    summary?: MeetingSummary
  ): Promise<void> {
    const session = await StorageService.getMeetingSession(sessionId);
    if (!session) {
      throw new Error("Meeting session not found");
    }

    session.status = "completed";
    session.endedAt = Date.now();

    await StorageService.saveMeetingSession(session);
  }

  async getActiveSessions(): Promise<MeetingSession[]> {
    const sessions = await StorageService.getAllMeetingSessions();
    return sessions.filter(
      (session) => session.status !== "completed" && session.status !== "error"
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (this.state.status === "error") {
        return false;
      }

      const isHealthy = await this.identityManager.isHealthy();

      if (!isHealthy) {
        this.state.status = "error";
        this.state.errorMessage = "Health check failed - agent identity issues";
      }

      return isHealthy;
    } catch (error) {
      this.state.status = "error";
      this.state.errorMessage = "Health check exception";
      return false;
    }
  }

  getState(): AgentState {
    return { ...this.state };
  }

  async getAccountBalance(): Promise<number> {
    return await this.identityManager.getAccountBalance();
  }

  getClient(): Client | null {
    return this.client;
  }

  getToolkit(): HederaLangchainToolkit | null {
    return this.toolkit;
  }

  isAgentInitialized(): boolean {
    return this.agentExecutor !== null;
  }

  async isAgentReady(): Promise<boolean> {
    try {
      if (this.state.status !== "active" || !this.agentExecutor) {
        return false;
      }

      if (!this.state.identity || !this.state.identity.isInitialized) {
        return false;
      }

      if (!this.client || !this.toolkit) {
        return false;
      }

      const tools = this.toolkit.getTools();
      if (tools.length === 0) {
        return false;
      }

      const requiredTools = ["create_topic_tool", "submit_topic_message_tool", "get_topic_messages_query_tool"];
      const toolNames = tools.map((t: any) => t.name);
      const missingTools = requiredTools.filter(
        (name) => !toolNames.includes(name)
      );

      if (missingTools.length > 0) {
        return false;
      }

      const apiKey = await StorageService.getOpenAIApiKey();
      if (!apiKey) {
        return false;
      }

      const isHealthy = await this.identityManager.isHealthy();
      if (!isHealthy) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error checking agent readiness:", error);
      return false;
    }
  }

  private getDefaultCapabilities(): AgentCapabilities {
    return {
      canTranscribe: true,
      canPublishToHCS: true,
      canDetectMeetings: true,
      canProcessAudio: true,
    };
  }

  private getDefaultConfig(): AgentConfig {
    return {
      network: "testnet",
      maxTranscriptionChunkSize: 1000,
      transcriptionInterval: 5000,
      heartbeatInterval: 30000,
    };
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      try {
        this.state.lastHeartbeat = Date.now();
        await StorageService.updateLastHeartbeat();
      } catch (error) {
        console.error("Heartbeat failed:", error);
      }
    }, this.state.config.heartbeatInterval) as NodeJS.Timeout;
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    const activeSessions = await this.getActiveSessions();
    for (const session of activeSessions) {
      await this.endMeetingSession(session.sessionId);
    }

    this.state.status = "idle";
  }
}
