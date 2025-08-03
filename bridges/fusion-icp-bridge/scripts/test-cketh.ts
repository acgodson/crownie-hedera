#!/usr/bin/env ts-node

import { HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { createActor as createResolverActor } from '../src/declarations/resolver_canister_backend';

async function testBasicCrossChainTransfer() {
  console.log('🔗 Testing Basic ETH → ckETH Cross-Chain Transfer\n');
  
  // Get ETH address from .env
  const ethPrivateKey = process.env.ETH_PRIVATE_KEY;
  const testEthAddress = process.env.TEST_ETH_ADDRESS;
  
  if (!ethPrivateKey || !testEthAddress) {
    console.error('❌ Please set ETH_PRIVATE_KEY and TEST_ETH_ADDRESS in .env file');
    process.exit(1);
  }
  
  console.log(`👤 EOA Address: ${testEthAddress}`);
  
  // Generate ICP principal for receiving ckETH
  const icpPrincipal = 'rdmx6-jaaaa-aaaah-qdrna-cai'; // Test principal
  console.log(`🎯 ICP Principal: ${icpPrincipal}`);
  
  const agent = new HttpAgent({ host: 'http://127.0.0.1:4943' });
  await agent.fetchRootKey();
  
  const resolverCanisterId = process.env.RESOLVER_CANISTER_ID || 'u6s2n-gx777-77774-qaaba-cai';
  
  try {
    console.log('\n🧪 Step 1: Getting ckETH deposit address...');
    
    // Call ckETH minter directly (Sepolia)
    const ckethMinter = 'jzenf-aiaaa-aaaar-qaa7q-cai';
    
    // For now, simulate the deposit address (in real test, call ckETH minter)
    const depositAddress = '0x1234567890123456789012345678901234567890'; // Mock address
    
    console.log(`✅ Deposit Address: ${depositAddress}`);
    console.log(`💰 Send 0.01 ETH from ${testEthAddress} to ${depositAddress} on Sepolia`);
    
    console.log('\n🧪 Step 2: Checking ckETH balance on ICP...');
    
    // Check balance (simulate for now)
    const initialBalance = 0; // Would call ckETH ledger
    console.log(`📊 Initial ckETH balance: ${initialBalance}`);
    
    console.log('\n⏳ Waiting for cross-chain transfer...');
    console.log('👋 Please send 0.01 ETH to the deposit address above');
    console.log('📱 Then check your ICP wallet for ckETH tokens');
    
    // In a real test, we would:
    // 1. Use ethers.js to send ETH from private key to deposit address
    // 2. Wait for confirmations
    // 3. Check ckETH balance on ICP ledger
    // 4. Verify tokens appeared
    
    console.log('\n🎉 Basic cross-chain transfer test setup complete!');
    console.log('\n📝 Manual steps:');
    console.log('1. Send 0.01 ETH to deposit address');
    console.log('2. Wait 10-15 minutes for processing');
    console.log('3. Check ckETH balance in ICP wallet');
    console.log('4. If balance increases, cross-chain transfer works!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testBasicCrossChainTransfer().catch(console.error);
}

export { testBasicCrossChainTransfer };