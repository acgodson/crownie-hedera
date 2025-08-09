import React, { useState, useEffect } from 'react'
import { Zap, ArrowRight, RefreshCw, AlertCircle, CheckCircle, ExternalLink, Key } from 'lucide-react'
import browser from 'webextension-polyfill'

interface OnboardingViewProps {
  onComplete: () => void
}

const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [isInitializing, setIsInitializing] = useState(false)
  const [privateKey, setPrivateKey] = useState('302e020100300506032b657004220420320cd6158cc0b2dd41d3013e92b108b679ed23853330fb4ba0ad1dcb162b1718')
  const [accountId, setAccountId] = useState('0.0.4691111')
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>('testnet')
  const [openaiApiKey, setOpenaiApiKey] = useState('sk-YSlaebRWGZY_7TB4YpJaf81KKZKa94wpER-HyaRO0lT3BlbkFJlkCTXUfBUj6Kdu-9vNkk2gh2AvhtQRp1EPBAZIkmQA')
  const [initStatus, setInitStatus] = useState<{
    success: boolean
    message: string
    accountId?: string
    balance?: number
  } | null>(null)


  useEffect(() => {
    const loadOnboardingState = async () => {
      try {
        const result = await browser.storage.local.get(['onboardingState'])
        if (result.onboardingState) {
          const state = result.onboardingState as any
          setCurrentStep(state.currentStep || 0)
          setPrivateKey(state.privateKey || '')
          setAccountId(state.accountId || '')
          setNetwork(state.network || 'testnet')
          setOpenaiApiKey(state.openaiApiKey || '')
        }
      } catch (error) {
        console.error('Failed to load onboarding state:', error)
      }
    }
    loadOnboardingState()
  }, [])


  useEffect(() => {
    const saveOnboardingState = async () => {
      try {
        await browser.storage.local.set({
          onboardingState: {
            currentStep,
            privateKey,
            accountId,
            network,
            openaiApiKey
          }
        })
      } catch (error) {
        console.error('Failed to save onboarding state:', error)
      }
    }

    // Only save if we're past the first step or have data
    if (currentStep > 0 || privateKey || accountId || openaiApiKey) {
      saveOnboardingState()
    }
  }, [currentStep, privateKey, accountId, network, openaiApiKey])

  const steps = [
    {
      icon: ExternalLink,
      title: 'Get Hedera Account',
      description: ''
    },
    {
      icon: Key,
      title: 'Import Credentials',
      description: 'Enter your private key and account ID from the portal'
    },
    {
      icon: Zap,
      title: 'OpenAI API Key',
      description: 'Enter your OpenAI API key for AI-powered transcription'
    },
    {
      icon: Zap,
      title: 'AI Agent Ready',
      description: 'Start using AI-powered meeting transcription'
    }
  ]

  const handleInitializeAgent = async () => {
    if (!privateKey.trim()) {
      setInitStatus({
        success: false,
        message: 'Please enter your private key'
      })
      return
    }

    if (!accountId.trim()) {
      setInitStatus({
        success: false,
        message: 'Account ID is required. Please enter your Hedera account ID (e.g., 0.0.123456)'
      })
      return
    }

    if (!openaiApiKey.trim()) {
      setInitStatus({
        success: false,
        message: 'OpenAI API key is required for AI-powered transcription'
      })
      return
    }

    const keyString = privateKey.trim();
    if (keyString.length < 32) {
      setInitStatus({
        success: false,
        message: 'Private key appears to be too short. Please check the format.'
      })
      return
    }

    const accountIdPattern = /^0\.0\.\d+$/;
    if (!accountIdPattern.test(accountId.trim())) {
      setInitStatus({
        success: false,
        message: 'Account ID must be in format 0.0.123456 (check for missing dots)'
      })
      return
    }

    // Validate OpenAI API key format (starts with sk-)
    if (!openaiApiKey.trim().startsWith('sk-')) {
      setInitStatus({
        success: false,
        message: 'OpenAI API key should start with "sk-". Please check your key.'
      })
      return
    }

    setIsInitializing(true)
    setInitStatus(null)

    try {
      console.log("🔧 OnboardingView: Starting account import...");
      
      // Save OpenAI API key first
      await browser.storage.local.set({
        openaiApiKey: openaiApiKey.trim()
      })
      console.log("✅ OnboardingView: OpenAI API key saved");

      // Import the account using the provided credentials
      console.log("🔧 OnboardingView: Sending IMPORT_ACCOUNT message...");
      const importResult = await browser.runtime.sendMessage({
        action: 'IMPORT_ACCOUNT',
        data: {
          privateKey: privateKey.trim(),
          accountId: accountId.trim(),
          network,
          openaiApiKey: openaiApiKey.trim()
        }
      }) as any

      console.log("🔧 OnboardingView: Import result received:", importResult);

      if (importResult?.success) {
        console.log("✅ OnboardingView: Account import successful");
        setInitStatus({
          success: true,
          message: 'Account imported successfully!',
          accountId: importResult.state.identity?.accountId,
          balance: 0 // Will be updated by health check
        })

        // Clear onboarding state on success
        browser.storage.local.remove('onboardingState')
        console.log("🔧 OnboardingView: Onboarding state cleared, calling onComplete in 2 seconds...");
        setTimeout(() => onComplete(), 2000)
      } else {
        console.error("❌ OnboardingView: Account import failed:", importResult?.error);
        setInitStatus({
          success: false,
          message: importResult?.error || 'Failed to import account. Please check your credentials.'
        })
      }
    } catch (error) {
      console.error("❌ OnboardingView: Exception during account import:", error);
      setInitStatus({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsInitializing(false)
    }
  }

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleInitializeAgent()
    }
  }

  const formatBalance = (balance?: number): string => {
    if (!balance) return '0 HBAR'
    return `${(balance / 100000000).toFixed(4)} HBAR`
  }

  if (initStatus) {
    return (
      <div className="w-full max-w-80 h-[500px] text-white flex flex-col items-center justify-center p-6"
        style={{
          background: '#1a1a1a',
          backgroundImage: `
               linear-gradient(rgba(243, 186, 80, 0.03) 1px, transparent 1px),
               linear-gradient(90deg, rgba(243, 186, 80, 0.03) 1px, transparent 1px)
             `,
          backgroundSize: '20px 20px'
        }}>
        <div className="text-center space-y-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${initStatus.success ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
            {initStatus.success ? (
              <CheckCircle className="w-8 h-8 text-green-400" />
            ) : (
              <AlertCircle className="w-8 h-8 text-red-400" />
            )}
          </div>

          <h2 className="text-lg font-semibold">
            {initStatus.success ? 'Welcome to Crownie!' : 'Setup Failed'}
          </h2>

          <p className="text-sm opacity-80">{initStatus.message}</p>

          {initStatus.success && initStatus.accountId && (
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-lg border" style={{
                background: 'rgba(243, 186, 80, 0.1)',
                borderColor: 'rgba(243, 186, 80, 0.3)'
              }}>
                <div className="font-semibold text-yellow-400 mb-1">Account ID</div>
                <div className="font-mono">{initStatus.accountId}</div>
              </div>

              <div className="p-3 rounded-lg border" style={{
                background: 'rgba(0, 0, 0, 0.2)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}>
                <div className="font-semibold mb-1">Balance</div>
                <div>{formatBalance(initStatus.balance)}</div>
              </div>
            </div>
          )}

          {!initStatus.success && (
            <button
              onClick={() => {
                setInitStatus(null)
                setCurrentStep(0)
              }}
              className="px-4 py-2 rounded-lg border font-medium text-sm hover:bg-white/5"
              style={{ borderColor: '#F3BA50', color: '#F3BA50' }}
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-80 h-[500px] text-white flex flex-col p-6"
      style={{
        background: '#1a1a1a',
        backgroundImage: `
             linear-gradient(rgba(243, 186, 80, 0.03) 1px, transparent 1px),
             linear-gradient(90deg, rgba(243, 186, 80, 0.03) 1px, transparent 1px)
           `,
        backgroundSize: '20px 20px'
      }}>

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold mb-2">Setup Your AI Agent</h1>
        <p className="text-sm opacity-80">Initialize your Hedera identity for AI-powered meeting transcription</p>
      </div>

      {/* Progress Indicator */}
      <div className="flex justify-center mb-4">
        <div className="flex items-center space-x-2">
          {steps.map((_, index) => (
            <React.Fragment key={index}>
              <div className={`w-3 h-3 rounded-full ${index <= currentStep ? 'bg-yellow-400' : 'bg-gray-600'
                }`} />
              {index < steps.length - 1 && (
                <div className={`w-4 h-0.5 ${index < currentStep ? 'bg-yellow-400' : 'bg-gray-600'
                  }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 flex flex-col text-center overflow-y-auto">
        <div className="flex-1 px-4 pb-2 overflow-y-auto">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 mx-auto"
            style={{ background: 'rgba(243, 186, 80, 0.1)' }}>
            {React.createElement(steps[currentStep].icon, { className: "w-7 h-7 text-yellow-400" })}
          </div>

          <h2 className="text-lg font-semibold mb-2">{steps[currentStep].title}</h2>
          <p className="text-sm opacity-80 mb-4 max-w-64 mx-auto">{steps[currentStep].description}</p>

          {/* Step 0: Portal Link */}
          {currentStep === 0 && (
            <div className="mb-6 w-full max-w-72 mx-auto space-y-3">
              <button
                onClick={() => window.open('https://portal.hedera.com', '_blank')}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border text-sm hover:bg-white/5"
                style={{ borderColor: '#F3BA50', color: '#F3BA50' }}
              >
                <ExternalLink className="w-4 h-4" />
                Hedera Developer Portal (Recommended)
              </button>
              <div className="text-xs opacity-60 space-y-1 mb-4">
                <div>• Sign up for free testnet account</div>
                <div>• Get 1000 HBAR funding automatically</div>
                <div>• Copy Account ID and Private Key</div>
              </div>

              <div className="text-xs opacity-40 text-center">OR</div>

              <button
                onClick={() => window.open('https://www.hashpack.app/', '_blank')}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border text-sm hover:bg-white/5"
                style={{ borderColor: 'rgba(255, 255, 255, 0.3)', color: 'rgba(255, 255, 255, 0.8)' }}
              >
                <ExternalLink className="w-4 h-4" />
                HashPack Wallet
              </button>
              <div className="text-xs opacity-60 space-y-1">
                <div>• Download wallet app</div>
                <div>• Create account (fund separately)</div>
                <div>• Export Account ID and Private Key</div>
              </div>
            </div>
          )}

          {/* Step 1: Import Form */}
          {currentStep === 1 && (
            <div className="mb-4 w-full max-w-72 mx-auto space-y-3">
              <div>
                <label className="block text-xs opacity-80 mb-2">Network</label>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value as 'testnet' | 'mainnet')}
                  className="w-full px-3 py-2 rounded border text-sm bg-black/20 text-white border-white/20"
                >
                  <option value="testnet">Testnet</option>
                  <option value="mainnet">Mainnet</option>
                </select>
              </div>

              <div>
                <label className="block text-xs opacity-80 mb-2">Account ID (Required)</label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => {
                    let value = e.target.value
                    if (value.match(/^0\.0\d+$/)) {
                      value = value.replace(/^0\.0(\d+)$/, '0.0.$1')
                    }
                    setAccountId(value)
                  }}
                  placeholder="0.0.1234567"
                  className="w-full px-3 py-2 rounded border text-sm bg-black/20 text-white border-white/20 placeholder-white/40"
                  required
                />
                <div className="text-xs opacity-60 mt-1">
                  Your Hedera account ID from the portal (required)
                </div>
              </div>

              <div>
                <label className="block text-xs opacity-80 mb-2">Private Key</label>
                <textarea
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="320cd6158cc0b2dd41d3013e92b108b679ed23853330fb4ba0ad1dcb162b1718"
                  rows={4}
                  className="w-full px-3 py-2 rounded border text-sm bg-black/20 text-white border-white/20 placeholder-white/40 resize-none"
                />
                <div className="text-xs opacity-60 mt-1">
                  ED25519 (64 hex chars), ECDSA (96 hex chars), or DER format
                </div>
              </div>
            </div>
          )}

          {/* Step 2: OpenAI API Key */}
          {currentStep === 2 && (
            <div className="mb-4 w-full max-w-72 mx-auto space-y-3">
              <div>
                <label className="block text-xs opacity-80 mb-2">OpenAI API Key (Required)</label>
                <input
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 rounded border text-sm bg-black/20 text-white border-white/20 placeholder-white/40"
                  required
                />
                <div className="text-xs opacity-60 mt-1">
                  Your OpenAI API key for AI-powered transcription
                </div>
              </div>

              <div className="p-3 rounded-lg border text-xs opacity-80" style={{
                background: 'rgba(243, 186, 80, 0.1)',
                borderColor: 'rgba(243, 186, 80, 0.3)'
              }}>
                <div className="font-semibold text-yellow-400 mb-2">How to get your OpenAI API key:</div>
                <div className="space-y-1">
                  <div>1. Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-yellow-400 underline">platform.openai.com/api-keys</a></div>
                  <div>2. Sign in or create an account</div>
                  <div>3. Click "Create new secret key"</div>
                  <div>4. Copy the key (starts with "sk-")</div>
                  <div>5. Paste it above</div>
                </div>
              </div>

              <div className="p-3 rounded-lg border text-xs opacity-80" style={{
                background: 'rgba(0, 0, 0, 0.2)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}>
                <div className="font-semibold mb-1">Security Note:</div>
                <div>Your API key is stored securely in your browser's local storage and is only used for transcription services.</div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Button Area */}
        <div className="px-4 pb-4 border-t border-white/10">
          {currentStep === steps.length - 1 ? (
            <button
              onClick={handleInitializeAgent}
              disabled={isInitializing}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-black disabled:opacity-50"
              style={{ background: isInitializing ? '#9ca3af' : '#F3BA50' }}
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Import Account
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleNextStep}
              className="w-full mt-3 flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-black"
              style={{ background: '#F3BA50' }}
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Info Footer */}
      <div className="text-center">
        <p className="text-xs opacity-60">
          Your private keys are stored securely in your browser
        </p>
      </div>
    </div>
  )
}

export default OnboardingView