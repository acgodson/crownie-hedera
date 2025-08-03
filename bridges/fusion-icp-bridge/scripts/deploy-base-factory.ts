#!/usr/bin/env ts-node

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

async function deployFactoryOnBase() {
  console.log('🚀 Deploying ICPBridgeFactory on Base Mainnet\n');
  
  const privateKey = process.env.ETH_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ Set ETH_PRIVATE_KEY in .env');
    process.exit(1);
  }
  
  
  // Base mainnet RPC
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log(`👤 Deployer: ${wallet.address}`);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
  
  if (balance < ethers.parseEther('0.001')) {
    console.error('❌ Need at least 0.001 ETH for deployment');
    process.exit(1);
  }
  
  try {
    // Read contract source
    const contractPath = path.join(__dirname, '../contracts/ICPBridgeFactory.sol');
    const contractSource = fs.readFileSync(contractPath, 'utf8');
    
    console.log('\n🔨 Compiling contract...');
    
    // Simple deployment - we'll manually compile or use hardhat
    const factoryAbi = [
      'constructor(address _icpResolver)',
      'function deployEscrow(address depositor, address recipient, uint256 amount, bytes32 hashlock, uint256 timelock) external returns (bytes32 escrowId, address escrow)',
      'function getEscrow(bytes32 escrowId) external view returns (address)',
      'function escrowCount() external view returns (uint256)',
      'event EscrowDeployed(bytes32 indexed escrowId, address indexed escrow, address indexed depositor, address recipient, uint256 amount, bytes32 hashlock, uint256 timelock)'
    ];
    
    // For now, we'll use a mock deployment address
    // In production, compile with solc or hardhat
    console.log('📝 Contract ABI prepared');
    console.log('🎯 Resolver address: Using wallet as resolver for testing');
    
    // Mock deployment for now - replace with actual bytecode
    console.log('\n✅ Factory deployment simulation complete');
    console.log('📍 Factory Address: [TO_BE_DEPLOYED]');
    console.log('🔗 Explorer: https://basescan.org/address/[ADDRESS]');
    
    // Save deployment info
    const deploymentInfo = {
      network: 'base-mainnet',
      chainId: 8453,
      factoryAddress: '[TO_BE_DEPLOYED]',
      resolverAddress: wallet.address,
      deployedAt: new Date().toISOString(),
      txHash: '[TX_HASH]'
    };
    
    fs.writeFileSync(
      path.join(__dirname, '../deployments/base-factory.json'),
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log('\n🎉 Deployment info saved to deployments/base-factory.json');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  deployFactoryOnBase().catch(console.error);
}

export { deployFactoryOnBase };