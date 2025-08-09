#!/usr/bin/env node

/**
 * Test script to verify identity management fixes
 * This simulates the onboarding flow and checks if identity is properly saved/restored
 */

import { StorageService } from './src/services/StorageService.js';
import { IdentityManager } from './src/agents/IdentityManager.js';
import { HederaAgent } from './src/agents/HederaAgent.js';

async function testIdentityManagement() {
  try {
    console.log('🔧 Testing identity management fixes...');
    
    // Test data
    const testPrivateKey = '302e020100300506032b657004220420320cd6158cc0b2dd41d3013e92b108b679ed23853330fb4ba0ad1dcb162b1718';
    const testAccountId = '0.0.4691111';
    const testNetwork = 'testnet';
    const testOpenAIApiKey = 'sk-V-gePzPj_nZHirwLQel-OUkMWyldqf1_ZRqri1rwm8T3BlbkFJeWgUULHC2QykUnFyyhtq3bMukSXozLzFDUhDEPhewA';
    
    console.log('🔧 Test data:', {
      accountId: testAccountId,
      network: testNetwork,
      hasPrivateKey: !!testPrivateKey,
      hasOpenAIApiKey: !!testOpenAIApiKey
    });
    
    // Step 1: Test IdentityManager import
    console.log('\n🔧 Step 1: Testing IdentityManager import...');
    const identityManager = new IdentityManager();
    
    try {
      const identity = await identityManager.importWithAccountId(
        testPrivateKey,
        testAccountId,
        testNetwork
      );
      
      console.log('✅ Identity imported successfully:', {
        accountId: identity.accountId,
        isInitialized: identity.isInitialized,
        network: identity.network
      });
      
      // Check if identity was saved to storage
      const savedIdentity = await StorageService.getAgentIdentity();
      console.log('✅ Identity saved to storage:', !!savedIdentity);
      
    } catch (error) {
      console.error('❌ Identity import failed:', error.message);
      return;
    }
    
    // Step 2: Test IdentityManager initialize (restore)
    console.log('\n🔧 Step 2: Testing IdentityManager initialize (restore)...');
    
    try {
      const restoredIdentity = await identityManager.initialize({
        network: testNetwork
      });
      
      console.log('✅ Identity restored successfully:', {
        accountId: restoredIdentity.accountId,
        isInitialized: restoredIdentity.isInitialized
      });
      
    } catch (error) {
      console.error('❌ Identity restore failed:', error.message);
      return;
    }
    
    // Step 3: Test HederaAgent importAccount
    console.log('\n🔧 Step 3: Testing HederaAgent importAccount...');
    
    // Save OpenAI API key first
    await StorageService.saveOpenAIApiKey(testOpenAIApiKey);
    
    const hederaAgent = new HederaAgent();
    
    try {
      const agentState = await hederaAgent.importAccount(
        testPrivateKey,
        testAccountId,
        testNetwork
      );
      
      console.log('✅ Agent import completed:', {
        status: agentState.status,
        hasIdentity: !!agentState.identity,
        accountId: agentState.identity?.accountId,
        errorMessage: agentState.errorMessage
      });
      
      // Check if agent state was saved
      const savedAgentState = await StorageService.getAgentState();
      console.log('✅ Agent state saved to storage:', !!savedAgentState);
      
    } catch (error) {
      console.error('❌ Agent import failed:', error.message);
      return;
    }
    
    // Step 4: Test HederaAgent restoreFromStorage
    console.log('\n🔧 Step 4: Testing HederaAgent restoreFromStorage...');
    
    const newHederaAgent = new HederaAgent();
    
    try {
      const restoredAgentState = await newHederaAgent.restoreFromStorage();
      
      if (restoredAgentState) {
        console.log('✅ Agent restored successfully:', {
          status: restoredAgentState.status,
          hasIdentity: !!restoredAgentState.identity,
          accountId: restoredAgentState.identity?.accountId
        });
      } else {
        console.log('❌ Agent restore returned null');
      }
      
    } catch (error) {
      console.error('❌ Agent restore failed:', error.message);
    }
    
    // Step 5: Test health check
    console.log('\n🔧 Step 5: Testing health check...');
    
    try {
      const isHealthy = await identityManager.isHealthy();
      const balance = await identityManager.getAccountBalance();
      
      console.log('✅ Health check completed:', {
        isHealthy,
        balance: balance / 100000000 + ' HBAR'
      });
      
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
    }
    
    console.log('\n✅ Identity management test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error stack:', error.stack);
  }
}

// Run the test
testIdentityManagement(); 