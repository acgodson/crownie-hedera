// Content script to inject into Internet Identity pages
(function() {
    'use strict';
    
    console.log('🔧 II Auth Injector: Loaded on', window.location.href);
    
    // Check if we're on an Internet Identity page
    const isIIPage = window.location.href.includes('identity.ic0.app') || 
                     window.location.href.includes('.localhost:4943');
    
    if (!isIIPage) {
        console.log('🔍 II Auth Injector: Not on II page, exiting');
        return;
    }
    
    console.log('🔍 II Auth Injector: On II page, setting up auth flow');
    
    // Function to trigger authentication using AuthClient
    async function triggerAuthentication() {
        try {
            console.log('🔍 II Auth Injector: Starting authentication...');
            
            // Import AuthClient
            const { AuthClient } = await import('https://unpkg.com/@dfinity/auth-client@0.19.3/lib/esm/index.js');
            
            // Create auth client
            const authClient = await AuthClient.create();
            
            // Get identity provider from current URL
            const identityProvider = window.location.origin;
            
            console.log('🔍 II Auth Injector: Using identity provider:', identityProvider);
            
            // Start login flow
            authClient.login({
                identityProvider,
                maxTimeToLive: BigInt(8 * 60 * 60 * 1000 * 1000 * 1000), // 8 hours
                onSuccess: async () => {
                    console.log('✅ II Auth Injector: Authentication successful!');
                    
                    const identity = authClient.getIdentity();
                    const principal = identity.getPrincipal();
                    
                    console.log('✅ II Auth Injector: Principal:', principal.toString());
                    
                    // Show success message
                    document.body.innerHTML = `
                        <div style="
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                            color: white;
                            padding: 30px;
                            border-radius: 15px;
                            text-align: center;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                            z-index: 10000;
                        ">
                            <h2 style="margin: 0 0 15px 0;">🎉 Authentication Successful!</h2>
                            <p style="margin: 0 0 20px 0;">You can now close this tab and return to your meeting.</p>
                            <p style="font-size: 12px; opacity: 0.8;">Principal: ${principal.toString().slice(0, 20)}...</p>
                        </div>
                    `;
                    
                    // Auto-close after 3 seconds
                    setTimeout(() => {
                        window.close();
                    }, 3000);
                },
                onError: (error) => {
                    console.error('❌ II Auth Injector: Authentication failed:', error);
                    
                    // Show error message
                    document.body.innerHTML = `
                        <div style="
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
                            color: white;
                            padding: 30px;
                            border-radius: 15px;
                            text-align: center;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                            z-index: 10000;
                        ">
                            <h2 style="margin: 0 0 15px 0;">❌ Authentication Failed</h2>
                            <p style="margin: 0;">Please try again or contact support.</p>
                        </div>
                    `;
                }
            });
            
        } catch (error) {
            console.error('❌ II Auth Injector: Failed to start auth:', error);
        }
    }
    
    // Add a button to trigger authentication
    function addAuthButton() {
        const button = document.createElement('button');
        button.innerHTML = '🎙️ Authenticate for IC Notetaker';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 25px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            transition: transform 0.2s ease;
        `;
        
        button.addEventListener('mouseover', () => {
            button.style.transform = 'translateY(-2px)';
        });
        
        button.addEventListener('mouseout', () => {
            button.style.transform = 'translateY(0)';
        });
        
        button.addEventListener('click', triggerAuthentication);
        
        document.body.appendChild(button);
        console.log('✅ II Auth Injector: Auth button added');
    }
    
    // Wait for page to load, then add button
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addAuthButton);
    } else {
        addAuthButton();
    }
    
})();