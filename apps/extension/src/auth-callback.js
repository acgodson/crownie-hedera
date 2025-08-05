// Auth callback script for IC Notetaker extension
(function() {
    'use strict';
    
    console.log('🔧 Auth Callback: Starting auth callback script...');

    async function handleAuthCallback() {
        const statusElement = document.getElementById('status');
        const resultElement = document.getElementById('result');
        
        try {
            console.log('🔍 Auth Callback: Processing authentication...');
            statusElement.textContent = 'Completing authentication...';
            
            // Import AuthClient dynamically to avoid module issues
            const { AuthClient } = await import('https://unpkg.com/@dfinity/auth-client@0.19.3/lib/esm/index.js');
            
            // Get auth client
            const authClient = await AuthClient.create();
            const isAuthenticated = await authClient.isAuthenticated();
            
            if (isAuthenticated) {
                const identity = authClient.getIdentity();
                const principal = identity.getPrincipal();
                
                console.log('✅ Auth Callback: Authentication successful:', principal.toString());
                
                // Show success
                statusElement.textContent = 'Authentication successful!';
                resultElement.innerHTML = '<div class="success">You can now close this tab and return to your meeting.</div>';
                
                // Notify the background script that auth is complete
                if (chrome?.runtime) {
                    try {
                        await chrome.runtime.sendMessage({
                            action: 'AUTH_COMPLETE',
                            data: {
                                success: true,
                                principal: principal.toString()
                            }
                        });
                        console.log('✅ Auth Callback: Notified background script of success');
                    } catch (error) {
                        console.warn('⚠️ Auth Callback: Could not notify background script:', error);
                    }
                }
                
                // Auto-close after 3 seconds
                setTimeout(() => {
                    window.close();
                }, 3000);
                
            } else {
                throw new Error('Authentication not completed');
            }
            
        } catch (error) {
            console.error('❌ Auth Callback: Authentication failed:', error);
            statusElement.textContent = 'Authentication failed';
            resultElement.innerHTML = '<div class="error">Authentication failed. Please try again.</div>';
        }
    }

    // Handle the callback when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleAuthCallback);
    } else {
        handleAuthCallback();
    }
})();