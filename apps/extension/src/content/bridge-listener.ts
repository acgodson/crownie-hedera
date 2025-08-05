console.log('🔍 Bridge Listener: Content script loaded on', window.location.href);

// Listen for window messages from AuthCallback component
window.addEventListener('message', (event) => {
  if (event.data.type === 'IC_NOTETAKER_AUTH_RESULT' && event.data.source === 'ic-notetaker-auth-callback') {
    console.log('🔍 Bridge Listener: Received auth result via postMessage:', event.data.data);
    
    // Forward to extension background script
    chrome.runtime.sendMessage({
      action: 'AUTH_BRIDGE_RESULT',
      data: event.data.data
    }).then(() => {
      console.log('✅ Bridge Listener: Forwarded auth result to background script');
    }).catch((error) => {
      console.error('❌ Bridge Listener: Failed to forward auth result:', error);
    });
  }
});

// Listen for localStorage changes as backup communication method
window.addEventListener('storage', (event) => {
  if (event.key === 'ic_notetaker_auth_result' && event.newValue) {
    try {
      const authData = JSON.parse(event.newValue);
      console.log('🔍 Bridge Listener: Received auth result via localStorage:', authData.data);
      
      // Forward to extension background script
      chrome.runtime.sendMessage({
        action: 'AUTH_BRIDGE_RESULT',
        data: authData.data
      }).then(() => {
        console.log('✅ Bridge Listener: Forwarded localStorage auth result to background script');
        
        // Clean up localStorage
        localStorage.removeItem('ic_notetaker_auth_result');
      }).catch((error) => {
        console.error('❌ Bridge Listener: Failed to forward localStorage auth result:', error);
      });
    } catch (error) {
      console.error('❌ Bridge Listener: Failed to parse localStorage auth result:', error);
    }
  }
});

// Also check localStorage on page load for any existing auth results
try {
  const existingAuthResult = localStorage.getItem('ic_notetaker_auth_result');
  if (existingAuthResult) {
    const authData = JSON.parse(existingAuthResult);
    console.log('🔍 Bridge Listener: Found existing auth result in localStorage:', authData.data);
    
    // Forward to extension background script
    chrome.runtime.sendMessage({
      action: 'AUTH_BRIDGE_RESULT',
      data: authData.data
    }).then(() => {
      console.log('✅ Bridge Listener: Forwarded existing localStorage auth result to background script');
      
      // Clean up localStorage
      localStorage.removeItem('ic_notetaker_auth_result');
    }).catch((error) => {
      console.error('❌ Bridge Listener: Failed to forward existing localStorage auth result:', error);
    });
  }
} catch (error) {
  console.error('❌ Bridge Listener: Failed to check existing localStorage auth result:', error);
}

console.log('✅ Bridge Listener: Content script initialized with all communication methods');