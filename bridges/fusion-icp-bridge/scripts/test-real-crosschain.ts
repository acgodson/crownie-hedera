#!/usr/bin/env ts-node

import { HttpAgent, Actor } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { ethers } from 'ethers';

async function testRealCrossChainTransfer() {
  console.log('🔗 Testing REAL ETH → ckETH Cross-Chain Transfer\n');
  
  // Get credentials from .env
  const ethPrivateKey = process.env.ETH_PRIVATE_KEY;
  const testEthAddress = process.env.TEST_ETH_ADDRESS;
  
  if (!ethPrivateKey || !testEthAddress) {
    console.error('❌ Please set ETH_PRIVATE_KEY and TEST_ETH_ADDRESS in .env file');
    process.exit(1);
  }
  
  console.log(`👤 EOA Address: ${testEthAddress}`);
  
  // ICP setup
  const icpPrincipal = Principal.fromText('rdmx6-jaaaa-aaaah-qdrna-cai');
  console.log(`🎯 ICP Principal: ${icpPrincipal.toString()}`);
  
  const agent = new HttpAgent({ host: 'https://ic0.app' }); // Use mainnet for ckETH
  
  try {
    console.log('\n🧪 Step 1: Getting real ckETH deposit address...');
    
    // ckETH Minter canister (Sepolia testnet)
    const ckethMinter = Principal.fromText('jzenf-aiaaa-aaaar-qaa7q-cai');
    
    // Simple IDL for ckETH minter
    const ckethIdl = ({ IDL }: any) => {
      return IDL.Service({
        'get_deposit_address': IDL.Func([IDL.Text, IDL.Principal], [IDL.Text], []),
        'get_balance': IDL.Func([IDL.Principal], [IDL.Nat], ['query']),
      });
    };
    
    const ckethActor = Actor.createActor(ckethIdl, {
      agent,
      canisterId: ckethMinter,
    });
    
    // Get deposit address
    const depositAddress = await ckethActor.get_deposit_address(testEthAddress, icpPrincipal) as string;
    console.log(`✅ Real Deposit Address: ${depositAddress}`);
    
    console.log('\n🧪 Step 2: Checking initial ckETH balance...');
    const initialBalance = await ckethActor.get_balance(icpPrincipal) as bigint;
    console.log(`📊 Initial ckETH balance: ${initialBalance.toString()}`);
    
    console.log('\n🧪 Step 3: Sending ETH from your EOA...');
    
    // Setup Ethereum connection (Sepolia)
    const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_INFURA_KEY');
    const wallet = new ethers.Wallet(ethPrivateKey, provider);
    
    const amount = ethers.parseEther('0.01'); // 0.01 ETH
    console.log(`💰 Sending ${ethers.formatEther(amount)} ETH to ${depositAddress}`);
    
    const tx = await wallet.sendTransaction({
      to: depositAddress as string,
      value: amount,
      gasLimit: 21000,
    });
    
    console.log(`📤 Transaction sent: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);
    
    console.log('\n🧪 Step 4: Monitoring ckETH balance...');
    console.log('⏳ Waiting for cross-chain processing (this takes 10-15 minutes)...');
    
    // Poll for balance change
    let attempts = 0;
    const maxAttempts = 20; // 20 attempts = ~10 minutes
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      
      const currentBalance = await ckethActor.get_balance(icpPrincipal) as bigint;
      const balanceChange = Number(currentBalance) - Number(initialBalance);
      
      console.log(`📊 Current ckETH balance: ${currentBalance.toString()} (change: +${balanceChange})`);
      
      if (balanceChange > 0) {
        console.log('\n🎉 SUCCESS! Cross-chain transfer completed!');
        console.log(`✅ Received ${balanceChange} ckETH on ICP`);
        console.log('🔗 ETH → ckETH cross-chain transfer is working!');
        return;
      }
      
      attempts++;
      console.log(`⏳ Attempt ${attempts}/${maxAttempts}, checking again in 30s...`);
    }
    
    console.log('\n⚠️ Balance not updated yet - transfer may still be processing');
    console.log('💡 Check your ICP wallet manually for ckETH tokens');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testRealCrossChainTransfer().catch(console.error);
}

export { testRealCrossChainTransfer };