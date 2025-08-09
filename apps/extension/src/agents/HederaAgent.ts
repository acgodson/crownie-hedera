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

      // Initialize identity (required for agent to work)
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

      console.log("🔧 Starting agent initialization...");
      console.log("🔧 Client available:", !!this.client);
      console.log("🔧 Toolkit available:", !!this.toolkit);

      console.log("🔧 Initializing agent without polyfills...");

      const openaiApiKey = await StorageService.getOpenAIApiKey();
      console.log(
        "🔑 HederaAgent: Retrieved API key from storage:",
        openaiApiKey ? "✅ Found" : "❌ Not found"
      );
      if (!openaiApiKey) {
        throw new Error(
          "OpenAI API key not found. Please set it in the onboarding process."
        );
      }
      console.log(
        "🔑 Using OpenAI API key:",
        `${openaiApiKey.substring(0, 10)}...`
      );

      if (typeof process !== "undefined" && process.env) {
        process.env.OPENAI_API_KEY = openaiApiKey;
      }

      console.log("🔧 Creating ChatOpenAI instance...");
      const llm = new ChatOpenAI({
        modelName: "gpt-4o-mini",
        temperature: 0,
        apiKey: openaiApiKey,
      });
      console.log("✅ ChatOpenAI instance created");

      console.log("🔧 Getting Hedera tools...");
      const hederaTools = this.toolkit.getTools();
      console.log("🔧 Hedera tools count:", hederaTools.length);
      console.log(
        "🔧 Hedera tool names:",
        hederaTools.map((t) => t.name)
      );

      console.log("🔧 Creating meeting tools...");
      const meetingTools = createMeetingTools(this.client);
      console.log("🔧 Meeting tools count:", meetingTools.length);
      console.log(
        "🔧 Meeting tool names:",
        meetingTools.map((t) => t.name)
      );

      const allTools = [...hederaTools, ...meetingTools];
      console.log("🔧 Total tools count:", allTools.length);

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

      console.log("🔧 Creating OpenAI tools agent...");
      const agent = await createOpenAIToolsAgent({
        llm,
        tools: allTools,
        prompt,
      });
      console.log("✅ OpenAI tools agent created");

      const memory = new BufferMemory({
        inputKey: "input",
        outputKey: "output",
        returnMessages: true,
      });

      console.log("🔧 Creating agent executor...");
      this.agentExecutor = new AgentExecutor({
        agent,
        tools: allTools,
        memory,
        returnIntermediateSteps: false,
      });
      console.log("✅ Agent executor created");

      console.log(
        "✅ Hedera Agent initialized with LangChain and Hedera tools"
      );
    } catch (error) {
      console.error("❌ Failed to initialize agent:", error);
      console.error(
        "❌ Error stack:",
        error instanceof Error ? error.stack : "No stack trace"
      );
      this.agentExecutor = null;
    }
  }

  async importAccount(
    privateKeyString: string,
    accountId: string,
    network: "testnet" | "mainnet" = "testnet"
  ): Promise<AgentState> {
    try {
      console.log("🔧 HederaAgent: Starting account import...");
      this.state.status = "initializing";

      // Import the identity first
      this.state.identity = await this.identityManager.importWithAccountId(
        privateKeyString,
        accountId,
        network
      );

      console.log("✅ HederaAgent: Identity imported successfully:", this.state.identity.accountId);

      // Get client and toolkit
      this.client = this.identityManager.getClient();
      this.toolkit = this.identityManager.getToolkit();

      console.log("🔧 HederaAgent: Client and toolkit obtained:", {
        hasClient: !!this.client,
        hasToolkit: !!this.toolkit
      });

      // Initialize the agent - this is required for the extension to work
      if (this.client && this.toolkit) {
        try {
          await this.initializeAgent();
          console.log("✅ HederaAgent: Agent initialized successfully");
        } catch (agentError) {
          console.error("❌ HederaAgent: Agent initialization failed:", agentError);
          console.error("❌ Agent error stack:", agentError instanceof Error ? agentError.stack : "No stack trace");
          throw new Error(`Agent initialization failed: ${agentError instanceof Error ? agentError.message : "Unknown error"}`);
        }
      } else {
        throw new Error("Failed to get client or toolkit from identity manager");
      }

      // Check if the account is healthy
      const isHealthy = await this.identityManager.isHealthy();
      console.log("🔧 HederaAgent: Account health check:", isHealthy);

      if (!isHealthy) {
        this.state.status = "error";
        this.state.errorMessage = "Imported account is not healthy - insufficient balance or network issues";
        await StorageService.saveAgentState(this.state);
        return this.state;
      }

      // Set status to active and save state
      this.state.status = "active";
      this.state.lastHeartbeat = Date.now();

      this.startHeartbeat();
      await StorageService.updateLastHeartbeat();
      await StorageService.saveAgentState(this.state);

      console.log("✅ HederaAgent: Account import completed successfully");
      return this.state;
    } catch (error) {
      console.error("❌ HederaAgent: Failed to import account:", error);
      this.state.status = "error";
      this.state.errorMessage =
        error instanceof Error ? error.message : "Failed to import account";
      await StorageService.saveAgentState(this.state);
      return this.state;
    }
  }

  // Method to reinitialize agent when API key becomes available
  async reinitializeAgent(): Promise<void> {
    try {
      console.log("🔧 HederaAgent: Attempting to reinitialize agent...");
      
      if (!this.client || !this.toolkit) {
        console.log("❌ HederaAgent: Cannot reinitialize - client or toolkit not available");
        return;
      }

      await this.initializeAgent();
      console.log("✅ HederaAgent: Agent reinitialized successfully");
      
      // Update the state to reflect successful reinitialization
      this.state.lastHeartbeat = Date.now();
      await StorageService.saveAgentState(this.state);
    } catch (error) {
      console.error("❌ HederaAgent: Failed to reinitialize agent:", error);
      // Don't update state on failure - keep the current state
    }
  }

  async restoreFromStorage(): Promise<AgentState | null> {
    try {
      console.log("🔧 HederaAgent: Attempting to restore from storage...");
      
      // First check if we're already properly initialized and active
      if (this.state.status === "active" && this.agentExecutor && this.client && this.toolkit) {
        console.log("✅ HederaAgent: Already active and properly initialized, skipping restore");
        return this.state;
      }
      
      const savedState = await StorageService.getAgentState();
      
      if (!savedState) {
        console.log("❌ HederaAgent: No saved state found");
        return null;
      }

      if (savedState.status !== "active") {
        console.log("❌ HederaAgent: Saved state is not active:", savedState.status);
        return null;
      }

      console.log("✅ HederaAgent: Found active saved state, restoring...");
      this.state = savedState;

      // Try to restore identity - if this fails, we can't restore
      try {
        this.state.identity = await this.identityManager.initialize(
          this.state.config
        );
        console.log("✅ HederaAgent: Identity restored successfully");
      } catch (identityError) {
        console.error("❌ HederaAgent: Failed to restore identity:", identityError);
        return null;
      }

      this.client = this.identityManager.getClient();
      this.toolkit = this.identityManager.getToolkit();

      if (!this.client || !this.toolkit) {
        console.log("❌ HederaAgent: Failed to restore client/toolkit");
        return null;
      }

      console.log("✅ HederaAgent: Client and toolkit restored");

      // Only initialize agent if we don't have an executor already
      if (!this.agentExecutor) {
        try {
          await this.initializeAgent();
          console.log("✅ HederaAgent: Agent initialized during restore");
        } catch (agentError) {
          console.error("❌ HederaAgent: Agent initialization failed during restore:", agentError);
          console.error("❌ Agent error stack:", agentError instanceof Error ? agentError.stack : "No stack trace");
          // Don't fail the restore for agent initialization issues - the identity is valid
          console.log("⚠️ HederaAgent: Continuing with restore despite agent initialization failure");
        }
      } else {
        console.log("✅ HederaAgent: Agent executor already exists, skipping initialization");
      }

      // Quick health check but don't fail restore on network issues
      try {
        const isHealthy = await this.identityManager.isHealthy();
        if (!isHealthy) {
          console.log("⚠️ HederaAgent: Health check failed but continuing restore");
        } else {
          console.log("✅ HederaAgent: Health check passed");
        }
      } catch (healthError) {
        console.log("⚠️ HederaAgent: Health check error but continuing restore:", healthError);
      }

      // Ensure heartbeat is running
      this.state.lastHeartbeat = Date.now();
      if (!this.heartbeatInterval) {
        this.startHeartbeat();
      }
      await StorageService.updateLastHeartbeat();

      console.log("✅ HederaAgent: Agent restored from storage successfully");
      return this.state;
    } catch (error) {
      console.error("❌ HederaAgent: Failed to restore agent from storage:", error);
      return null;
    }
  }

  async initiateMeetingSession(meetingData: {
    title: string;
    url: string;
    platform: string;
    sessionId: string;
  }): Promise<{ topicId: string; session: any }> {
    if (!this.agentExecutor) {
      throw new Error(
        "Agent not initialized - cannot initiate meeting session"
      );
    }

    // Proceed without crypto checks - let Hedera SDK handle it

    const task = `Initiate a new meeting session with the following details:
- Title: ${meetingData.title}
- URL: ${meetingData.url} 
- Platform: ${meetingData.platform}
- Session ID: ${meetingData.sessionId}

Please:
1. Create an HCS topic for this meeting using create_topic_tool
2. Publish a meeting_start message with these details using submit_topic_message_tool
3. Set up the session for transcription processing

Return the topic ID and session details as JSON.`;

    try {
      console.log("🤖 Agent initiating meeting session...");
      const result = await this.agentExecutor.invoke({
        input: task,
        context: meetingData,
      });

      console.log("✅ Agent completed meeting session initiation");
      console.log("🤖 Agent result:", result);

      // Parse the result to extract topic ID
      let topicId = "";
      if (typeof result.output === "string" && result.output.includes("0.0.")) {
        const topicMatch = result.output.match(/0\.0\.\d+/);
        topicId = topicMatch ? topicMatch[0] : "";
      }

      if (!topicId) {
        console.warn(
          "⚠️ No topic ID found in agent result. This may indicate a crypto or Hedera SDK issue."
        );
        console.warn("⚠️ Agent output:", result.output);
      }

      return {
        topicId,
        session: {
          sessionId: meetingData.sessionId,
          topicId,
          title: meetingData.title,
          platform: meetingData.platform,
          startTime: Date.now(),
        },
      };
    } catch (error) {
      console.error("❌ Agent failed to initiate meeting session:", error);

      // Check if it's a crypto-related error
      if (
        error instanceof Error &&
        (error.message.includes("crypto") ||
          error.message.includes("subtle") ||
          error.message.includes("CryptoKey") ||
          error.message.includes("sign") ||
          error.message.includes("CreateTopic"))
      ) {
        console.error(
          "🔧 This appears to be a crypto-related error in Hedera SDK"
        );
        console.error("🔧 Crypto availability:", {
          globalThis: !!globalThis.crypto,
          subtle: !!(globalThis.crypto && globalThis.crypto.subtle),
          methods: globalThis.crypto?.subtle
            ? Object.keys(globalThis.crypto.subtle)
            : [],
        });
      }

      throw error;
    }
  }

  async processTranscriptionSegment(segmentData: {
    sessionId: string;
    topicId: string;
    segment: any;
  }): Promise<void> {
    if (!this.agentExecutor) {
      throw new Error(
        "Agent not initialized - cannot process transcription segment"
      );
    }

    const task = `Process a new transcription segment for the ongoing meeting:
- Session ID: ${segmentData.sessionId}
- Topic ID: ${segmentData.topicId}
- Segment Text: "${segmentData.segment.text}"
- Confidence: ${segmentData.segment.confidence}
- Sequence: ${segmentData.segment.sequence}

Please:
1. Evaluate if this segment should be published to HCS
2. Format the segment data appropriately
3. Submit the transcription message to the HCS topic
4. Handle any publishing errors gracefully`;

    try {
      console.log("🤖 Agent processing transcription segment...");
      await this.agentExecutor.invoke({
        input: task,
        context: segmentData,
      });

      console.log("✅ Agent completed transcription segment processing");
    } catch (error) {
      console.error("❌ Agent failed to process transcription segment:", error);
      throw error;
    }
  }

  async finalizeMeetingSession(sessionData: {
    sessionId: string;
    topicId: string;
    endTime: number;
    totalSegments: number;
    totalWords: number;
  }): Promise<void> {
    if (!this.agentExecutor) {
      throw new Error(
        "Agent not initialized - cannot finalize meeting session"
      );
    }

    const task = `Finalize the meeting session that just ended:
- Session ID: ${sessionData.sessionId}
- Topic ID: ${sessionData.topicId}
- End Time: ${new Date(sessionData.endTime).toISOString()}
- Total Segments: ${sessionData.totalSegments}
- Total Words: ${sessionData.totalWords}

Please:
1. Generate a comprehensive meeting summary using the transcription data
2. Publish a meeting_end message with session statistics
3. Publish the meeting summary to the HCS topic
4. Clean up any temporary session data
5. Archive the meeting session appropriately`;

    try {
      console.log("🤖 Agent finalizing meeting session...");
      await this.agentExecutor.invoke({
        input: task,
        context: sessionData,
      });

      console.log("✅ Agent completed meeting session finalization");
    } catch (error) {
      console.error("❌ Agent failed to finalize meeting session:", error);
      throw error;
    }
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
      console.error("❌ Agent execution failed:", error);
      throw error;
    }
  }

  async startRecordingWithAgent(meetingId: string): Promise<any> {
    return await this.executeAgentTask(
      `Start recording session for meeting ${meetingId}. Create HCS topic and begin processing transcription segments.`,
      { meetingId }
    );
  }

  async processTranscriptionSegmentWithAgent(
    meetingId: string,
    segment: any
  ): Promise<any> {
    return await this.executeAgentTask(
      `Process transcription segment for meeting ${meetingId}. Analyze content and decide whether to publish to HCS or batch for later.`,
      { meetingId, segment }
    );
  }

  async stopRecordingWithAgent(
    meetingId: string,
    transcriptSegments: any[]
  ): Promise<any> {
    return await this.executeAgentTask(
      `Stop recording session for meeting ${meetingId}. Generate comprehensive meeting summary from all transcript segments and publish final results to HCS. Include key points, action items, and decisions.`,
      { meetingId, transcriptSegments }
    );
  }

  async generateMeetingSummaryWithAgent(
    meetingId: string,
    transcriptSegments: any[]
  ): Promise<any> {
    return await this.executeAgentTask(
      `Generate a comprehensive meeting summary for meeting ${meetingId} from the provided transcript segments. Extract key points, action items, decisions made, and participant insights. Format as a structured summary.`,
      { meetingId, transcriptSegments }
    );
  }

  async getMeetingHistoryWithAgent(query: string): Promise<any> {
    return await this.executeAgentTask(
      `Query meeting history: ${query}. Fetch relevant HCS topics and provide natural language response.`,
      { query }
    );
  }

  async getMeetingTranscriptWithAgent(meetingId: string): Promise<any> {
    return await this.executeAgentTask(
      `Get full transcript for meeting ${meetingId}. Fetch all transcription messages from HCS topic.`,
      { meetingId }
    );
  }

  async getActionItemsWithAgent(meetingId: string): Promise<any> {
    return await this.executeAgentTask(
      `Extract action items from meeting ${meetingId}. Analyze HCS messages for tasks and decisions.`,
      { meetingId }
    );
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

    if (!session.hcsTopicId) {
      const result = await this.executeAgentTask(
        `Create HCS topic for meeting ${session.meetingInfo.meetingId} with title "${session.meetingInfo.title}". Use create_topic_tool and then publish meeting start message.`,
        {
          meetingId: session.meetingInfo.meetingId,
          title: session.meetingInfo.title,
          platform: session.meetingInfo.platform,
        }
      );

      if (result.success) {
        session.hcsTopicId = result.topicId;
      }
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
    const session = await StorageService.getMeetingSession(sessionId);
    if (!session) {
      throw new Error("Meeting session not found");
    }

    if (!session.transcriptionEnabled) {
      throw new Error("Transcription not enabled for this session");
    }

    await this.executeAgentTask(
      `Publish transcription segment to HCS topic for meeting ${session.meetingInfo.meetingId}. Use submit_topic_message_tool with the transcription data.`,
      {
        meetingId: session.meetingInfo.meetingId,
        topicId: session.hcsTopicId,
        segment: chunk,
      }
    );
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

    if (summary) {
      await this.executeAgentTask(
        `Publish meeting end summary to HCS topic for meeting ${session.meetingInfo.meetingId}. Use submit_topic_message_tool with the summary data.`,
        {
          meetingId: session.meetingInfo.meetingId,
          topicId: session.hcsTopicId,
          summary,
        }
      );
    }

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
      console.log("🔍 Checking agent readiness...");

      // Check if agent is initialized and active
      if (this.state.status !== "active" || !this.agentExecutor) {
        console.log(
          "❌ Agent not ready - status:",
          this.state.status,
          "executor:",
          !!this.agentExecutor
        );
        return false;
      }

      // Check if identity is properly initialized
      if (!this.state.identity || !this.state.identity.isInitialized) {
        console.log("❌ Agent not ready - no identity or not initialized:", {
          hasIdentity: !!this.state.identity,
          isInitialized: this.state.identity?.isInitialized,
        });
        return false;
      }

      // Check if we have a valid client and toolkit
      if (!this.client || !this.toolkit) {
        console.log("❌ Agent not ready - missing client or toolkit:", {
          hasClient: !!this.client,
          hasToolkit: !!this.toolkit,
        });
        return false;
      }

      // Check if toolkit has the required tools
      const tools = this.toolkit.getTools();
      if (tools.length === 0) {
        console.log("❌ Agent not ready - toolkit has no tools available");
        return false;
      }

      const requiredTools = ["create_topic_tool", "submit_topic_message_tool"];
      const toolNames = tools.map((t: any) => t.name);
      const missingTools = requiredTools.filter(
        (name) => !toolNames.includes(name)
      );

      if (missingTools.length > 0) {
        console.log(
          "❌ Agent not ready - missing required tools:",
          missingTools
        );
        console.log("Available tools:", toolNames);
        return false;
      }

      // Check OpenAI API key
      const apiKey = await StorageService.getOpenAIApiKey();
      if (!apiKey) {
        console.log("❌ Agent not ready - no OpenAI API key");
        return false;
      }

      // Check if identity manager is healthy
      const isHealthy = await this.identityManager.isHealthy();
      if (!isHealthy) {
        console.log("❌ Agent not ready - identity manager not healthy");
        return false;
      }

      console.log("✅ Agent is fully ready!");
      return true;
    } catch (error) {
      console.error("❌ Error checking agent readiness:", error);
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
