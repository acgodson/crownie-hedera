import React, { useEffect, useState } from 'react';

const AuthCallback: React.FC = () => {
  const [status, setStatus] = useState('Processing wallet connection...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleWalletCallback();
  }, []);

  const handleWalletCallback = async () => {
    try {
      console.log('🔍 Wallet Callback: Starting wallet connection processing...');
      setStatus('Connecting to Ethereum wallet...');
      
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No Ethereum wallet found. Please install MetaMask or another wallet.');
      }
      
      console.log('🔍 Wallet Callback: Requesting account access...');
      setStatus('Requesting account access...');
      
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      if (accounts.length > 0) {
        const address = accounts[0];
        console.log('✅ Wallet Callback: Connection successful!', address);
        
        setStatus('Connection successful! Communicating with extension...');
        
        // Send wallet data to extension
        await communicateWithExtension({
          success: true,
          address: address,
          chainId: await window.ethereum.request({ method: 'eth_chainId' })
        });
        
        setStatus('✅ Wallet connected! You can close this tab.');
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          window.close();
        }, 3000);
        
      } else {
        throw new Error('No accounts found - wallet connection incomplete');
      }
      
    } catch (error) {
      console.error('❌ Wallet Callback: Error during connection:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setStatus('❌ Wallet connection failed');
      
      // Notify extension of failure
      await communicateWithExtension({
        success: false,
        error: error instanceof Error ? error.message : 'Wallet connection failed'
      });
    }
  };

  const communicateWithExtension = async (walletData: any) => {
    try {
      console.log('🔍 Wallet Callback: Attempting to communicate with extension...');
      
      // Method 1: Try to communicate via window.postMessage to extension content scripts
      window.postMessage({
        type: 'CROWNIE_WALLET_RESULT',
        data: walletData,
        source: 'crownie-wallet-callback'
      }, '*');
      
      // Method 2: Try chrome.runtime.sendMessage with extension ID from URL params
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          // Get extension ID from URL search params if provided
          const urlParams = new URLSearchParams(window.location.search);
          const extensionId = urlParams.get('extensionId');
          
          if (extensionId) {
            await chrome.runtime.sendMessage(extensionId, {
              action: 'WALLET_BRIDGE_RESULT',
              data: walletData
            });
            console.log('✅ Wallet Callback: Notified extension via chrome.runtime.sendMessage with ID:', extensionId);
          } else {
            console.warn('⚠️ Wallet Callback: No extension ID provided in URL params');
          }
        } catch (chromeError) {
          console.warn('⚠️ Wallet Callback: chrome.runtime.sendMessage failed:', chromeError);
        }
      }
      
      // Method 3: Use localStorage as a fallback communication method
      try {
        localStorage.setItem('crownie_wallet_result', JSON.stringify({
          timestamp: Date.now(),
          data: walletData
        }));
        console.log('✅ Wallet Callback: Stored wallet result in localStorage');
        
        // Trigger storage event
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'crownie_wallet_result',
          newValue: JSON.stringify(walletData),
          url: window.location.href
        }));
      } catch (storageError) {
        console.warn('⚠️ Wallet Callback: localStorage communication failed:', storageError);
      }
      
      console.log('✅ Wallet Callback: Communication attempts completed');
      
    } catch (error) {
      console.error('❌ Wallet Callback: Failed to communicate with extension:', error);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '40px',
        textAlign: 'center',
        maxWidth: '500px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{ margin: '0 0 30px 0', fontSize: '28px' }}>
          🏛️ Crownie Etherlink
        </h1>
        
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderRadius: '50%',
          borderTop: '4px solid white',
          animation: 'spin 1s linear infinite',
          margin: '20px auto'
        }} />
        
        <p style={{ 
          fontSize: '18px', 
          margin: '20px 0',
          lineHeight: '1.5'
        }}>
          {status}
        </p>
        
        {error && (
          <div style={{
            background: 'rgba(244, 67, 54, 0.2)',
            border: '1px solid rgba(244, 67, 54, 0.4)',
            borderRadius: '10px',
            padding: '15px',
            margin: '20px 0',
            fontSize: '14px'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        
        <p style={{ 
          fontSize: '14px', 
          opacity: 0.8,
          margin: '30px 0 0 0'
        }}>
          This page will close automatically once wallet connection is complete.
        </p>
        
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
      </div>
    </div>
  );
};

export default AuthCallback;