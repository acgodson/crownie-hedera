import React, { useState, useEffect } from 'react'
import { ExternalLink, Copy, AlertTriangle, RefreshCw } from 'lucide-react'
import browser from 'webextension-polyfill'

interface FundingGuideProps {
  accountId: string
  balance: number
  onClose: () => void
}

const FundingGuide: React.FC<FundingGuideProps> = ({ accountId, balance: initialBalance, onClose }) => {
  const [currentBalance, setCurrentBalance] = useState(initialBalance)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const formatBalance = (balance: number): string => {
    return `${(balance / 100000000).toFixed(8)} HBAR`
  }

  const copyAccountId = () => {
    navigator.clipboard.writeText(accountId)
  }

  const openFaucet = () => {
    window.open('https://portal.hedera.com/faucet', '_blank')
  }

  const openPortal = () => {
    window.open('https://portal.hedera.com', '_blank')
  }

  const refreshBalance = async () => {
    setIsRefreshing(true)
    try {
      const healthResponse = await browser.runtime.sendMessage({ action: 'HEALTH_CHECK' }) as any
      if (healthResponse?.balance !== undefined) {
        setCurrentBalance(healthResponse.balance)
      }
    } catch (error) {
      console.error('Failed to refresh balance:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    // Poll for balance updates every 10 seconds
    const interval = setInterval(refreshBalance, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full max-w-80 h-[500px] text-white flex flex-col p-4"
         style={{
           background: '#1a1a1a',
           backgroundImage: `
             linear-gradient(rgba(243, 186, 80, 0.03) 1px, transparent 1px),
             linear-gradient(90deg, rgba(243, 186, 80, 0.03) 1px, transparent 1px)
           `,
           backgroundSize: '20px 20px'
         }}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Account Funding</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded"
        >
          ×
        </button>
      </div>

      {/* Current Status */}
      <div className="mb-4 p-3 rounded-lg border" style={{ 
        background: currentBalance > 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
        borderColor: currentBalance > 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)' 
      }}>
        <div className="flex items-center gap-2 mb-2">
          {currentBalance > 0 ? (
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          )}
          <span className="text-sm font-medium">
            {currentBalance > 0 ? 'Account Funded' : 'Account Needs Funding'}
          </span>
          <button
            onClick={refreshBalance}
            disabled={isRefreshing}
            className="ml-auto p-1 hover:bg-white/10 rounded disabled:opacity-50"
            title="Refresh balance"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <div className="text-xs opacity-80 mb-3">
          Current Balance: <span className="font-mono">{formatBalance(currentBalance)}</span>
        </div>

        <div className="space-y-2">
          <div className="text-xs opacity-60">Account ID:</div>
          <div className="flex items-center gap-2 p-2 rounded bg-black/20">
            <span className="font-mono text-xs flex-1">{accountId}</span>
            <button
              onClick={copyAccountId}
              className="p-1 hover:bg-white/10 rounded"
              title="Copy Account ID"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Funding Instructions */}
      <div className="flex-1 overflow-y-auto">
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">How to Fund Your Account</h3>
          <div className="text-xs opacity-80 space-y-2">
            <p>Your imported account should already have HBAR from the source where you got it. If you need more funding:</p>
          </div>
        </div>

        <div className="space-y-3 pb-4">
          <div className="p-3 rounded-lg border" style={{ 
            background: 'rgba(0, 0, 0, 0.2)', 
            borderColor: 'rgba(243, 186, 80, 0.3)' 
          }}>
            <div className="text-sm font-medium mb-1">Option 1: Testnet Faucet</div>
            <div className="text-xs opacity-80 mb-3">
              Add 100 HBAR daily to your existing account
            </div>
            <button
              onClick={openFaucet}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded border text-sm hover:bg-white/5"
              style={{ borderColor: '#F3BA50', color: '#F3BA50' }}
            >
              <ExternalLink className="w-3 h-3" />
              Open Hedera Faucet
            </button>
          </div>

          <div className="p-3 rounded-lg border" style={{ 
            background: 'rgba(0, 0, 0, 0.2)', 
            borderColor: 'rgba(59, 130, 246, 0.3)' 
          }}>
            <div className="text-sm font-medium mb-1">Option 2: Create New Portal Account</div>
            <div className="text-xs opacity-80 mb-2">
              Create additional account with 1000 HBAR
            </div>
            <div className="text-xs opacity-60 mb-3">
              Import the new credentials to switch accounts
            </div>
            <button
              onClick={() => window.open('https://portal.hedera.com', '_blank')}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded border text-sm hover:bg-white/5"
              style={{ borderColor: 'rgba(59, 130, 246, 0.5)', color: 'rgba(59, 130, 246, 0.9)' }}
            >
              <ExternalLink className="w-3 h-3" />
              Open Developer Portal
            </button>
          </div>

          <div className="p-3 rounded-lg border" style={{ 
            background: 'rgba(0, 0, 0, 0.2)', 
            borderColor: 'rgba(255, 255, 255, 0.1)' 
          }}>
            <div className="text-sm font-medium mb-1">Option 3: HashPack Wallet</div>
            <div className="text-xs opacity-80 mb-2">
              Mobile wallet with 100 HBAR auto-funding
            </div>
            <div className="text-xs opacity-60 mb-3">
              Download app, create testnet account
            </div>
            <button
              onClick={() => window.open('https://www.hashpack.app/', '_blank')}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded border text-sm hover:bg-white/5"
              style={{ borderColor: 'rgba(255, 255, 255, 0.3)', color: 'rgba(255, 255, 255, 0.8)' }}
            >
              <ExternalLink className="w-3 h-3" />
              Get HashPack
            </button>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-4 p-2 rounded text-xs opacity-60 text-center">
        Once funded, your agent will automatically start working
      </div>
    </div>
  )
}

export default FundingGuide