#!/usr/bin/env node

/**
 * Test script to verify crypto polyfill works in service worker context
 * This simulates the extension's service worker environment
 */

// Simulate service worker environment
globalThis.self = globalThis;
globalThis.chrome = {
  runtime: {
    onMessage: { addListener: () => {} },
    sendMessage: () => Promise.resolve({}),
  },
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve({}),
    },
  },
};

// Remove any existing crypto to simulate service worker environment
delete globalThis.crypto;

console.log('🔧 Testing crypto polyfill in service worker context...');
console.log('Initial crypto state:');
console.log('  - globalThis.crypto:', !!globalThis.crypto);
console.log('  - globalThis.crypto.subtle:', !!(globalThis.crypto && globalThis.crypto.subtle));

// Import and setup crypto polyfill from built files
import { setupCryptoPolyfill, testCryptoPolyfill } from './dist/background.js';

// Setup crypto polyfill
setupCryptoPolyfill({ enableLogging: true });

// Test the polyfill
const result = await testCryptoPolyfill();
console.log('🔧 Crypto polyfill test result:', result);

if (result.success) {
  console.log('✅ Crypto polyfill is working correctly!');
  console.log('✅ Details:', result.details);
  
  // Test Hedera SDK compatibility
  console.log('🔧 Testing Hedera SDK compatibility...');
  
  try {
    const { Client, PrivateKey, AccountId } = await import('@hashgraph/sdk');
    console.log('✅ Hedera SDK imports successfully');
    
    // Try to create a client
    const client = Client.forTestnet();
    console.log('✅ Hedera client created successfully');
    
    // Try to create a private key (this requires crypto.subtle)
    const privateKey = PrivateKey.fromStringED25519('302e020100300506032b657004220420320cd6158cc0b2dd41d3013e92b108b679ed23853330fb4ba0ad1dcb162b1718');
    console.log('✅ Private key created successfully');
    
    // Try to create an account ID
    const accountId = AccountId.fromString('0.0.4691111');
    console.log('✅ Account ID created successfully');
    
    console.log('✅ Hedera SDK is fully compatible with crypto polyfill!');
    
  } catch (error) {
    console.error('❌ Hedera SDK compatibility test failed:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
  
} else {
  console.error('❌ Crypto polyfill test failed:', result.error);
  if (result.stack) {
    console.error('❌ Stack trace:', result.stack);
  }
} 