#!/usr/bin/env node

/**
 * Test script to validate the crypto fix in the extension
 * This simulates the service worker environment
 */

// Simulate the service worker global environment
globalThis.self = globalThis;

// Import the crypto polyfill directly
import { setupCryptoPolyfill, testCryptoPolyfill } from './src/utils/index.ts';

async function testCryptoFix() {
  try {
    console.log('🧪 Testing crypto fix validation...');
    
    // 1. Set up crypto polyfill like the extension does
    console.log('🔧 Setting up crypto polyfill...');
    setupCryptoPolyfill({ enableLogging: true });
    
    // 2. Verify crypto is available
    console.log('🔍 Checking crypto availability...');
    console.log('  - globalThis.crypto:', !!globalThis.crypto);
    console.log('  - globalThis.crypto.subtle:', !!(globalThis.crypto && globalThis.crypto.subtle));
    
    if (!globalThis.crypto || !globalThis.crypto.subtle) {
      throw new Error('Crypto polyfill setup failed');
    }
    
    // 3. Test crypto functionality
    console.log('🧪 Testing crypto functionality...');
    const result = await testCryptoPolyfill();
    
    if (!result.success) {
      throw new Error(`Crypto test failed: ${result.error}`);
    }
    
    console.log('✅ Crypto test passed!');
    console.log('✅ Details:', result.details);
    
    // 4. Test if we can import Hedera SDK (the critical test)
    console.log('🌐 Testing Hedera SDK import...');
    const { Client } = await import('@hashgraph/sdk');
    
    // Try to create a client
    const client = Client.forTestnet();
    console.log('✅ Hedera Client created successfully');
    
    // Clean up
    client.close?.();
    
    console.log('✅ All tests passed! The crypto fix should work in the extension.');
    console.log('✅ The extension should now be able to create HCS topics without crypto.subtle errors.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('❌ This indicates the crypto fix may not work properly in the extension.');
    process.exit(1);
  }
}

// Run the test
testCryptoFix();