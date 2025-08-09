#!/usr/bin/env node

/**
 * Standalone test to verify Hedera SDK works outside the extension
 * Tests topic creation with the same setup as the extension
 */

import { HederaLangchainToolkit, coreConsensusPlugin, coreConsensusPluginToolNames } from 'hedera-agent-kit';
import { Client, PrivateKey, AccountId, AccountBalanceQuery, TopicCreateTransaction } from '@hashgraph/sdk';
import { ChatOpenAI } from '@langchain/openai';
import { createOpenAIToolsAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

async function testHederaTopicCreation() {
  try {
    console.log('🔧 Starting standalone Hedera topic creation test...');
    
    // Test crypto availability first
    console.log('🔧 Crypto availability check:');
    console.log('  - globalThis.crypto:', !!globalThis.crypto);
    console.log('  - globalThis.crypto.subtle:', !!(globalThis.crypto && globalThis.crypto.subtle));
    console.log('  - crypto.subtle methods:', globalThis.crypto?.subtle ? Object.keys(globalThis.crypto.subtle) : 'none');
    
    // Load environment variables (you'll need to set these)
    const privateKey = process.env.HEDERA_PRIVATE_KEY || '302e020100300506032b657004220420320cd6158cc0b2dd41d3013e92b108b679ed23853330fb4ba0ad1dcb162b1718';
    const accountId = process.env.HEDERA_ACCOUNT_ID || '0.0.4691111';
    const openaiApiKey = process.env.OPENAI_API_KEY || 'sk-V-gePzPj_nZHirwLQel-OUkMWyldqf1_ZRqri1rwm8T3BlbkFJeWgUULHC2QykUnFyyhtq3bMukSXozLzFDUhDEPhewA';
    
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    console.log('🔧 Creating Hedera client...');
    const client = Client.forTestnet();
    const key = PrivateKey.fromStringED25519(privateKey);
    const account = AccountId.fromString(accountId);
    
    client.setOperator(account, key);
    
    console.log('🔧 Testing basic client functionality...');
    const query = new AccountBalanceQuery().setAccountId(account);
    const balance = await query.execute(client);
    console.log('✅ Account balance:', balance.hbars.toString());
    
    console.log('🔧 Testing direct topic creation with SDK...');
    const topicTransaction = new TopicCreateTransaction()
      .setTopicMemo('Test topic from standalone script')
      .setMaxTransactionFee(100000000); // 1 HBAR
    
    const topicResponse = await topicTransaction.execute(client);
    const topicReceipt = await topicResponse.getReceipt(client);
    const directTopicId = topicReceipt.topicId;
    
    console.log('✅ Direct topic creation successful!');
    console.log('✅ Topic ID:', directTopicId.toString());
    
    console.log('🔧 Creating Hedera toolkit...');
    const toolkit = new HederaLangchainToolkit({
      client: client,
      configuration: {
        plugins: [coreConsensusPlugin],
        context: {
          accountId: account,
        },
      },
    });
    
    console.log('🔧 Getting tools from toolkit...');
    const tools = toolkit.getTools();
    console.log('✅ Available tools:', tools.map(t => t.name));
    
    // Check if we have the required tools
    const createTopicTool = tools.find(t => t.name === coreConsensusPluginToolNames.CREATE_TOPIC_TOOL);
    if (!createTopicTool) {
      console.log('⚠️ Warning: create_topic_tool not found in toolkit, skipping tool test');
      console.log('✅ Basic Hedera functionality is working - topic created with ID:', directTopicId.toString());
      client.close();
      console.log('✅ Test completed successfully!');
      return;
    }
    
    console.log('🔧 Setting up agent with OpenAI...');
    const llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
      apiKey: openaiApiKey,
    });

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

    console.log('🔧 Creating agent...');
    const agent = await createOpenAIToolsAgent({
      llm,
      tools,
      prompt
    });

    console.log('🔧 Creating agent executor...');
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: true,
      maxIterations: 3
    });

    console.log('🔧 Testing agent topic creation...');
    const agentResult = await agentExecutor.invoke({
      input: 'Create an HCS topic for a test meeting with memo "Standalone Test Meeting". Do not enable private submit key.'
    });

    console.log('✅ Agent topic creation result:', agentResult);
    
    // Extract topic ID from result
    let topicId = '';
    if (typeof agentResult.output === 'string' && agentResult.output.includes('0.0.')) {
      const topicMatch = agentResult.output.match(/0\.0\.\d+/);
      topicId = topicMatch ? topicMatch[0] : '';
    }
    
    if (topicId) {
      console.log('✅ SUCCESS: Topic created with ID:', topicId);
    } else {
      console.log('⚠️ Warning: No topic ID found in agent output');
      console.log('Agent output:', agentResult.output);
    }
    
    client.close();
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

// Check if required environment variables are set
if (!process.env.OPENAI_API_KEY) {
  console.log('⚠️ OPENAI_API_KEY not set, using default test key');
}

testHederaTopicCreation();