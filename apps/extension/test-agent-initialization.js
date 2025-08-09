#!/usr/bin/env node

/**
 * Test script to isolate agent initialization issues
 * This will help us understand why the AI agent is failing to initialize
 */

import { setupCryptoPolyfill, testCryptoPolyfill, testHederaCompatibility } from './src/utils/cryptoPolyfill.js';
import { StorageService } from './src/services/StorageService.js';

async function testAgentInitialization() {
  try {
    console.log('🔧 Testing agent initialization...');
    
    // Step 1: Test crypto polyfill
    console.log('\n🔧 Step 1: Testing crypto polyfill...');
    setupCryptoPolyfill({ enableLogging: true });
    
    const cryptoTest = await testCryptoPolyfill();
    console.log('Crypto test result:', cryptoTest);
    
    if (!cryptoTest.success) {
      console.error('❌ Crypto polyfill failed:', cryptoTest.error);
      return;
    }
    
    // Step 2: Test Hedera SDK compatibility
    console.log('\n🔧 Step 2: Testing Hedera SDK compatibility...');
    const hederaTest = await testHederaCompatibility();
    console.log('Hedera compatibility test result:', hederaTest);
    
    if (!hederaTest.success) {
      console.error('❌ Hedera compatibility failed:', hederaTest.error);
      return;
    }
    
    // Step 3: Test LangChain imports
    console.log('\n🔧 Step 3: Testing LangChain imports...');
    
    try {
      console.log('🔧 Importing ChatOpenAI...');
      const { ChatOpenAI } = await import('@langchain/openai');
      console.log('✅ ChatOpenAI imported successfully');
      
      console.log('🔧 Importing createOpenAIToolsAgent...');
      const { createOpenAIToolsAgent } = await import('langchain/agents');
      console.log('✅ createOpenAIToolsAgent imported successfully');
      
      console.log('🔧 Importing ChatPromptTemplate...');
      const { ChatPromptTemplate } = await import('@langchain/core/prompts');
      console.log('✅ ChatPromptTemplate imported successfully');
      
      console.log('🔧 Importing BufferMemory...');
      const { BufferMemory } = await import('langchain/memory');
      console.log('✅ BufferMemory imported successfully');
      
      console.log('🔧 Importing AgentExecutor...');
      const { AgentExecutor } = await import('langchain/agents');
      console.log('✅ AgentExecutor imported successfully');
      
    } catch (importError) {
      console.error('❌ LangChain import failed:', importError);
      console.error('Import error stack:', importError.stack);
      return;
    }
    
    // Step 4: Test OpenAI API key retrieval
    console.log('\n🔧 Step 4: Testing OpenAI API key retrieval...');
    
    // Set a test API key
    const testApiKey = 'sk-V-gePzPj_nZHirwLQel-OUkMWyldqf1_ZRqri1rwm8T3BlbkFJeWgUULHC2QykUnFyyhtq3bMukSXozLzFDUhDEPhewA';
    await StorageService.saveOpenAIApiKey(testApiKey);
    
    const retrievedKey = await StorageService.getOpenAIApiKey();
    console.log('OpenAI API key retrieval:', {
      saved: !!testApiKey,
      retrieved: !!retrievedKey,
      matches: testApiKey === retrievedKey
    });
    
    if (!retrievedKey) {
      console.error('❌ OpenAI API key retrieval failed');
      return;
    }
    
    // Step 5: Test ChatOpenAI instance creation
    console.log('\n🔧 Step 5: Testing ChatOpenAI instance creation...');
    
    try {
      const { ChatOpenAI } = await import('@langchain/openai');
      
      const llm = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0,
        apiKey: retrievedKey,
      });
      
      console.log('✅ ChatOpenAI instance created successfully');
      
      // Test a simple call (this will fail if the API key is invalid, but that's expected)
      try {
        console.log('🔧 Testing OpenAI API call...');
        const response = await llm.invoke('Say "Hello, World!"');
        console.log('✅ OpenAI API call successful:', response.content);
      } catch (apiError) {
        console.warn('⚠️ OpenAI API call failed (expected if key is invalid):', apiError.message);
        // This is expected if the API key is not valid
      }
      
    } catch (llmError) {
      console.error('❌ ChatOpenAI creation failed:', llmError);
      return;
    }
    
    // Step 6: Test Hedera toolkit creation
    console.log('\n🔧 Step 6: Testing Hedera toolkit creation...');
    
    try {
      const { Client, PrivateKey, AccountId } = await import('@hashgraph/sdk');
      const { HederaLangchainToolkit, coreConsensusPlugin } = await import('hedera-agent-kit');
      
      // Create a test client
      const client = Client.forTestnet();
      const privateKey = PrivateKey.fromStringED25519('302e020100300506032b657004220420320cd6158cc0b2dd41d3013e92b108b679ed23853330fb4ba0ad1dcb162b1718');
      const accountId = AccountId.fromString('0.0.4691111');
      
      client.setOperator(accountId, privateKey);
      
      // Create toolkit
      const toolkit = new HederaLangchainToolkit({
        client: client,
        configuration: {
          plugins: [coreConsensusPlugin],
          context: {
            accountId: accountId,
          },
        },
      });
      
      const tools = toolkit.getTools();
      console.log('✅ Hedera toolkit created successfully');
      console.log('Tools available:', tools.map(t => t.name));
      
    } catch (toolkitError) {
      console.error('❌ Hedera toolkit creation failed:', toolkitError);
      return;
    }
    
    // Step 7: Test full agent creation
    console.log('\n🔧 Step 7: Testing full agent creation...');
    
    try {
      const { ChatOpenAI } = await import('@langchain/openai');
      const { createOpenAIToolsAgent, AgentExecutor } = await import('langchain/agents');
      const { ChatPromptTemplate } = await import('@langchain/core/prompts');
      const { BufferMemory } = await import('langchain/memory');
      const { Client, PrivateKey, AccountId } = await import('@hashgraph/sdk');
      const { HederaLangchainToolkit, coreConsensusPlugin } = await import('hedera-agent-kit');
      
      // Create client and toolkit
      const client = Client.forTestnet();
      const privateKey = PrivateKey.fromStringED25519('302e020100300506032b657004220420320cd6158cc0b2dd41d3013e92b108b679ed23853330fb4ba0ad1dcb162b1718');
      const accountId = AccountId.fromString('0.0.4691111');
      client.setOperator(accountId, privateKey);
      
      const toolkit = new HederaLangchainToolkit({
        client: client,
        configuration: {
          plugins: [coreConsensusPlugin],
          context: {
            accountId: accountId,
          },
        },
      });
      
      // Create LLM
      const llm = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0,
        apiKey: retrievedKey,
      });
      
      // Create tools
      const hederaTools = toolkit.getTools();
      console.log('Hedera tools count:', hederaTools.length);
      
      // Create prompt
      const prompt = ChatPromptTemplate.fromTemplate(`
You are a Hedera-powered AI agent that manages meeting recordings and HCS operations.

Current task: {input}

{agent_scratchpad}
      `);
      
      // Create agent
      const agent = await createOpenAIToolsAgent({
        llm,
        tools: hederaTools,
        prompt,
      });
      
      // Create memory
      const memory = new BufferMemory({
        inputKey: "input",
        outputKey: "output",
        returnMessages: true,
      });
      
      // Create executor
      const agentExecutor = new AgentExecutor({
        agent,
        tools: hederaTools,
        memory,
        returnIntermediateSteps: false,
      });
      
      console.log('✅ Full agent creation successful!');
      
    } catch (agentError) {
      console.error('❌ Full agent creation failed:', agentError);
      console.error('Agent error stack:', agentError.stack);
      return;
    }
    
    console.log('\n✅ All agent initialization tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error stack:', error.stack);
  }
}

// Run the test
testAgentInitialization(); 