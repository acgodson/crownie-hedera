// Offscreen document for Internet Identity authentication
// This runs in a document context with access to window/DOM
import { AuthClient } from '@dfinity/auth-client';
import { ENV } from './utils/env';

console.log('🔧 Offscreen: Starting offscreen document for Internet Identity auth');

let authClient = null;

// Initialize AuthClient when offscreen document loads
async function initAuthClient() {
  try {
    console.log('🔍 Offscreen: Creating AuthClient...');
    authClient = await AuthClient.create({
      idleOptions: {
        disableIdle: true
      }
    });
    console.log('✅ Offscreen: AuthClient created successfully');
  } catch (error) {
    console.error('❌ Offscreen: Failed to create AuthClient:', error);
  }
}

// Handle authentication requests from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🔍 Offscreen: Received message:', message.action);
  
  switch (message.action) {
    case 'AUTH_INIT':
      handleAuthInit(sendResponse);
      return true; // Keep response channel open
      
    case 'AUTH_LOGIN':
      handleAuthLogin(sendResponse);
      return true; // Keep response channel open
      
    case 'AUTH_CHECK':
      handleAuthCheck(sendResponse);
      return true; // Keep response channel open
      
    case 'AUTH_LOGOUT':
      handleAuthLogout(sendResponse);
      return true; // Keep response channel open
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

async function handleAuthInit(sendResponse) {
  try {
    await initAuthClient();
    sendResponse({ success: true });
  } catch (error) {
    console.error('❌ Offscreen: Init failed:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

async function handleAuthLogin(sendResponse) {
  try {
    if (!authClient) {
      await initAuthClient();
    }
    
    console.log('🔍 Offscreen: Starting Internet Identity login...');
    
    const identityProvider = ENV.IS_LOCAL
      ? `http://${ENV.CANISTER_ID_INTERNET_IDENTITY}.localhost:4943`
      : "https://identity.ic0.app";
    
    console.log('🔍 Offscreen: Using identity provider:', identityProvider);
    
    // This will work in offscreen document because we have window/DOM access
    await authClient.login({
      identityProvider,
      maxTimeToLive: BigInt(8 * 60 * 60 * 1000 * 1000 * 1000), // 8 hours
      onSuccess: async () => {
        try {
          console.log('✅ Offscreen: Authentication successful!');
          
          const identity = authClient.getIdentity();
          const principal = identity.getPrincipal();
          
          if (!principal.isAnonymous()) {
            console.log('✅ Offscreen: Principal:', principal.toString());
            
            sendResponse({
              success: true,
              principalText: principal.toString()
            });
          } else {
            throw new Error('Principal is anonymous');
          }
        } catch (error) {
          console.error('❌ Offscreen: Post-auth processing failed:', error);
          sendResponse({
            success: false,
            error: error.message
          });
        }
      },
      onError: (error) => {
        console.error('❌ Offscreen: Authentication failed:', error);
        sendResponse({
          success: false,
          error: error || 'Authentication failed'
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Offscreen: Login process failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleAuthCheck(sendResponse) {
  try {
    if (!authClient) {
      await initAuthClient();
    }
    
    const isAuthenticated = await authClient.isAuthenticated();
    
    if (isAuthenticated) {
      const identity = authClient.getIdentity();
      const principal = identity.getPrincipal();
      
      if (!principal.isAnonymous()) {
        sendResponse({
          isAuthenticated: true,
          principalText: principal.toString()
        });
        return;
      }
    }
    
    sendResponse({
      isAuthenticated: false
    });
    
  } catch (error) {
    console.error('❌ Offscreen: Auth check failed:', error);
    sendResponse({
      isAuthenticated: false,
      error: error.message
    });
  }
}

async function handleAuthLogout(sendResponse) {
  try {
    if (!authClient) {
      await initAuthClient();
    }
    
    await authClient.logout();
    console.log('✅ Offscreen: Logout successful');
    
    sendResponse({ success: true });
    
  } catch (error) {
    console.error('❌ Offscreen: Logout failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Initialize when the offscreen document loads
console.log('🔧 Offscreen: Offscreen document loaded, ready for authentication');