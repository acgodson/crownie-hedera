import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import browser from 'webextension-polyfill'
import {
  X,
  Check,
  Mic,
  MicOff,
  Video,
  Users,
  MessageSquare,
  Phone,
  Globe,
  ArrowLeft,
} from 'lucide-react'
import { useMeetingStore } from '../stores/meetingStore'
import logo from '../assets/logo.png'
import OnboardingView from './OnboardingView'
import FundingGuide from './FundingGuide'
import googleMeetIcon from '../assets/google_meet.png'
import zoomIcon from '../assets/zoom.png'
import teamsIcon from '../assets/teams.png'
import discordIcon from '../assets/discord.png'
import ordersIcon from '../assets/orders.png'
import historyIcon from '../assets/history.png'

interface MeetingState {
  isRecording: boolean
  meetingId?: string
  platform?: string
  duration: number
  isActive: boolean
}

interface AgentState {
  status: 'initializing' | 'active' | 'idle' | 'error'
  accountId?: string
  balance?: number
  isHealthy: boolean
  errorMessage?: string
}


const PopupView: React.FC = () => {
  const [currentView, setCurrentView] = useState<'main' | 'orders' | 'history' | 'funding'>('main')
  const [meetingState, setMeetingState] = useState<MeetingState>({
    isRecording: false,
    duration: 0,
    isActive: false
  })
  const [meetingCode, setMeetingCode] = useState('')
  const [agentState, setAgentState] = useState<AgentState>({
    status: 'initializing',
    isHealthy: false
  })
  const [showOnboarding, setShowOnboarding] = useState(false)
  
  // Orders state - now using chrome.storage.local
  const [orders, setOrders] = useState<Record<string, any>>({})
  const [activeOrderIds, setActiveOrderIds] = useState<string[]>([])

  useEffect(() => {
    checkAgentStatus()
    checkMeetingStatus()
    loadOrders()
    
    // Poll for agent status, meeting status, and orders
    const interval = setInterval(() => {
      checkAgentStatus()
      checkMeetingStatus()
      loadOrders()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadOrders = async () => {
    try {
      const result = await browser.storage.local.get(['orders'])
      if (result.orders) {
        setOrders(result.orders)
        console.log('📋 Popup: Loaded orders from storage:', Object.keys(result.orders).length)
      }
    } catch (error) {
      console.error('Failed to load orders:', error)
    }
  }

  const checkAgentStatus = async () => {
    try {
      const healthResponse = await browser.runtime.sendMessage({ action: 'HEALTH_CHECK' }) as any
      const stateResponse = await browser.runtime.sendMessage({ action: 'GET_AGENT_STATE' }) as any
      
      if (healthResponse && stateResponse) {
        setAgentState({
          status: stateResponse.status || 'idle',
          accountId: stateResponse.identity?.accountId,
          balance: healthResponse.balance,
          isHealthy: healthResponse.status === 'healthy',
          errorMessage: stateResponse.errorMessage
        })
        
        // Show onboarding only if agent is in error state AND we're not already showing onboarding
        if ((stateResponse.status === 'error' || !stateResponse.identity) && agentState.status !== 'active') {
          setShowOnboarding(true)
        }
      }
    } catch (error) {
      setAgentState(prev => ({ 
        ...prev, 
        status: 'error', 
        isHealthy: false,
        errorMessage: 'Failed to connect to agent'
      }))
      setShowOnboarding(true)
    }
  }

  const checkMeetingStatus = async () => {
    try {
      const response = await browser.runtime.sendMessage({ action: 'GET_MEETING_STATUS' }) as any
      console.log('🔍 Popup: Meeting status response:', response)
      
      if (response) {
        setMeetingState(prev => ({
          ...prev,
          platform: response.platform,
          isActive: response.isMeetingDetected,
          meetingId: response.meetingId,
          isRecording: response.isRecording,
          duration: response.recordingDuration
        }))
        
        // Generate meeting code if detected
        if (response.isMeetingDetected && !meetingCode) {
          setMeetingCode(Math.floor(Math.random() * 900000000000) + 100000000000 + '')
        }
      }
    } catch (error) {
      console.log('Failed to get meeting status:', error)
      setMeetingState(prev => ({ ...prev, platform: undefined, isActive: false }))
    }
  }


  const handleStartRecording = async () => {
    try {
      await browser.runtime.sendMessage({ action: 'START_RECORDING' })
      setMeetingState(prev => ({ ...prev, isRecording: true }))
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const handleStopRecording = async () => {
    try {
      await browser.runtime.sendMessage({ action: 'STOP_RECORDING' })
      setMeetingState(prev => ({ ...prev, isRecording: false, duration: 0 }))
    } catch (error) {
      console.error('Failed to stop recording:', error)
    }
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'Google Meet':
        return <Video className="w-4 h-4" />
      case 'Zoom':
        return <Video className="w-4 h-4" />
      case 'Microsoft Teams':
        return <Users className="w-4 h-4" />
      case 'Cisco Webex':
        return <Phone className="w-4 h-4" />
      case 'Discord':
        return <MessageSquare className="w-4 h-4" />
      default:
        return <Globe className="w-4 h-4" />
    }
  }



  const handleOnboardingComplete = async () => {
    setShowOnboarding(false)
    
    // Get the final agent state after successful initialization
    try {
      const stateResponse = await browser.runtime.sendMessage({ action: 'GET_AGENT_STATE' }) as any
      const healthResponse = await browser.runtime.sendMessage({ action: 'HEALTH_CHECK' }) as any
      
      if (stateResponse?.identity) {
        setAgentState({
          status: stateResponse.status || 'active',
          accountId: stateResponse.identity.accountId,
          balance: healthResponse?.balance || 0,
          isHealthy: healthResponse?.status === 'healthy',
          errorMessage: undefined
        })
      }
    } catch (error) {
      console.error('Failed to get final agent state:', error)
    }
  }

  // Show onboarding if needed
  if (showOnboarding && agentState.status === 'error') {
    return <OnboardingView onComplete={handleOnboardingComplete} />
  }

  // Show funding guide if requested
  if (currentView === 'funding' && agentState.accountId) {
    return (
      <FundingGuide
        accountId={agentState.accountId}
        balance={agentState.balance || 0}
        onClose={() => setCurrentView('main')}
      />
    )
  }

  const mockMeetings = [
    {
      id: 'meet-1',
      title: 'Meet - dez-hjuv-xzc',
      date: 'Aug 03, 2025, 04:23 AM',
      duration: '10m',
      status: 'Ongoing'
    },
    {
      id: 'meet-2',
      title: 'Meet - dez-hjuv-xzc',
      date: 'Aug 03, 2025, 04:23 AM',
      duration: '10m',
      status: 'Completed'
    },
    {
      id: 'meet-3',
      title: 'Meet - dez-hjuv-xzc',
      date: 'Aug 03, 2025, 04:23 AM',
      duration: '10m',
      status: 'Completed'
    },
    {
      id: 'meet-4',
      title: 'Meet - dez-hjuv-xzc',
      date: 'Aug 03, 2025, 04:23 AM',
      duration: '10m',
      status: 'Completed'
    }
  ]

  if (currentView === 'orders') {
    return (
      <div className="w-full max-w-80 h-[500px] text-white flex flex-col relative" 
           style={{
             background: '#1a1a1a',
             backgroundImage: `
               linear-gradient(rgba(243, 186, 80, 0.03) 1px, transparent 1px),
               linear-gradient(90deg, rgba(243, 186, 80, 0.03) 1px, transparent 1px)
             `,
             backgroundSize: '20px 20px'
           }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: 'rgba(243, 186, 80, 0.1)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentView('main')} className="p-1 hover:bg-white/10 rounded">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="font-medium">Orders</span>
          </div>
        </div>

        {/* Orders List */}
        <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
          {Object.values(orders).length === 0 ? (
            <div className="text-center py-8">
              <div className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                No orders yet
              </div>
              <div className="text-xs mt-1" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                Start a trade to see orders here
              </div>
            </div>
          ) : (
            Object.values(orders).map((order: any) => (
              <div key={order.id} style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(243, 186, 80, 0.1)' }} className="rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white font-medium">
                    {order.fromAmount} {order.fromToken}
                  </div>
                  <button 
                    onClick={() => navigator.clipboard.writeText(order.id)}
                    className="text-xs hover:text-white transition-colors cursor-pointer" 
                    style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                    title="Copy Order ID"
                  >
                    ID: {order.id.slice(0, 8)}... 📋
                  </button>
                </div>

                <div className="text-xs mb-2" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  To: {order.toAmount} {order.toToken}
                </div>

                <div className="text-xs mb-2" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  Meeting: {order.meetingId}
                </div>

                {order.escrowAddress && (
                  <div className="text-xs mb-2" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                    Escrow: 
                    <button 
                      onClick={() => navigator.clipboard.writeText(order.escrowAddress)}
                      className="ml-1 hover:text-white transition-colors cursor-pointer"
                      title="Copy Escrow Address"
                    >
                      {order.escrowAddress.slice(0, 6)}...{order.escrowAddress.slice(-4)} 📋
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#F3BA50' }}>
                      <span className="text-xs text-black font-bold">{order.fromToken?.[0] || '?'}</span>
                    </div>
                    <ArrowLeft className="w-3 h-3 rotate-180" style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                    <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#F3BA50' }}>
                      <span className="text-xs text-black font-bold">{order.toToken?.[0] || '?'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      order.status === 'pending' ? 'text-black' : 
                      order.status === 'active' ? 'text-white' : 
                      order.status === 'fulfilled' ? 'text-white' : 
                      'text-white'
                    }`}
                    style={{ 
                      background: order.status === 'pending' ? '#F3BA50' : 
                                 order.status === 'active' ? '#10b981' : 
                                 order.status === 'fulfilled' ? '#059669' :
                                 '#6b7280'
                    }}>
                      {order.status}
                    </span>
                    {activeOrderIds.includes(order.id) && (
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#F3BA50' }}></div>
                    )}
                  </div>
                </div>

                {/* Escrow Balance Display */}
                {order.status === 'active' && (
                  <div className="mt-2 space-y-1 text-xs" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                    <div className="flex justify-between">
                      <span>Maker Escrow:</span>
                      <span className="text-white">{order.makerEscrowBalance || '0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taker Escrow:</span>
                      <span className="text-white">{order.takerEscrowBalance || '0'}</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-3 pt-2 border-t space-y-2" style={{ borderColor: 'rgba(243, 186, 80, 0.1)' }}>
                  {order.status === 'pending' && (
                    <button 
                      onClick={async () => {
                        try {
                          await browser.runtime.sendMessage({
                            action: 'OPEN_FILL_ORDER',
                            data: {
                              orderId: order.id,
                              meetingId: order.meetingId
                            }
                          })
                        } catch (error) {
                          console.error('Failed to open fill order page:', error)
                        }
                      }}
                      className="w-full py-2 text-xs rounded border hover:bg-white/5 transition-colors"
                      style={{ borderColor: '#F3BA50', color: '#F3BA50' }}
                    >
                      Fill Order
                    </button>
                  )}
                  
                  {order.status === 'active' && order.makerEscrowBalance && parseFloat(order.makerEscrowBalance) > 0 && (
                    <button 
                      onClick={async () => {
                        try {
                          // Get meeting secret for completing the order
                          const secretResponse = await browser.runtime.sendMessage({
                            action: 'GET_MEETING_SECRET',
                            data: { meetingId: order.meetingId }
                          })
                          
                          const secret = (secretResponse as any)?.secret || ''
                          
                          await browser.runtime.sendMessage({
                            action: 'OPEN_COMPLETE_ORDER',
                            data: {
                              orderId: order.id,
                              meetingId: order.meetingId,
                              secret
                            }
                          })
                        } catch (error) {
                          console.error('Failed to open complete order page:', error)
                        }
                      }}
                      className="w-full py-2 text-xs rounded border hover:bg-white/5 transition-colors"
                      style={{ borderColor: '#10b981', color: '#10b981' }}
                    >
                      Complete Order
                    </button>
                  )}
                  
                  {order.status === 'fulfilled' && (
                    <div className="text-center text-xs text-green-400 font-medium">
                      ✅ Order Completed
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  if (currentView === 'history') {
    return (
      <div className="w-full max-w-80 h-[500px] text-white flex flex-col relative"
           style={{
             background: '#1a1a1a',
             backgroundImage: `
               linear-gradient(rgba(243, 186, 80, 0.03) 1px, transparent 1px),
               linear-gradient(90deg, rgba(243, 186, 80, 0.03) 1px, transparent 1px)
             `,
             backgroundSize: '20px 20px'
           }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: 'rgba(243, 186, 80, 0.1)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentView('main')} className="p-1 hover:bg-white/10 rounded">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="font-medium">Meeting History</span>
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
          {mockMeetings.map((meeting) => (
            <div key={meeting.id} style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(243, 186, 80, 0.1)' }} className="rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">{meeting.title}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${meeting.status === 'Ongoing'
                    ? 'text-black'
                    : 'text-white'
                    }`}
                    style={{ 
                      background: meeting.status === 'Ongoing' ? '#F3BA50' : '#10b981'
                    }}>
                    {meeting.status}
                  </span>
                </div>
              </div>

              <div className="text-xs mb-3" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                {meeting.date} {meeting.duration}
              </div>

              <div className="flex items-center gap-3">
                <button className="text-xs hover:underline" style={{ color: '#F3BA50' }}>
                  Download
                </button>
                <button className="text-xs hover:underline" style={{ color: '#F3BA50' }}>
                  Share
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-80 h-[500px] text-white flex flex-col relative"
         style={{
           background: '#1a1a1a',
           backgroundImage: `
             linear-gradient(rgba(243, 186, 80, 0.03) 1px, transparent 1px),
             linear-gradient(90deg, rgba(243, 186, 80, 0.03) 1px, transparent 1px)
           `,
           backgroundSize: '20px 20px'
         }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: 'rgba(243, 186, 80, 0.1)' }}>
        <div className="flex items-center gap-2">
          <img src={logo} alt="Crownie" className="w-6 h-6" />
          <span className="font-medium">Crownie</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentView('funding')}
            className="flex items-center gap-1 hover:bg-white/5 px-2 py-1 rounded"
            disabled={!agentState.accountId}
          >
            <div className={`w-2 h-2 rounded-full ${agentState.isHealthy ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              {agentState.status === 'active' ? 'Active' : 
               agentState.status === 'initializing' ? 'Initializing' :
               agentState.status === 'error' ? 'Error' : 'Idle'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="px-4 py-6 w-full">
        {meetingState.isActive ? (
          <div className="space-y-4 w-full">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full border-2 flex items-center justify-center mb-4" style={{ borderColor: '#F3BA50', background: 'rgba(243, 186, 80, 0.1)' }}>
                <Check className="w-6 h-6" style={{ color: '#F3BA50' }} />
              </div>
            </div>

            <h2 className="text-lg font-medium text-center">Meeting Detected</h2>

            {meetingState.platform && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full border" style={{ background: 'rgba(243, 186, 80, 0.1)', borderColor: 'rgba(243, 186, 80, 0.3)' }}>
                  {getPlatformIcon(meetingState.platform)}
                  <span className="text-sm" style={{ color: '#F3BA50' }}>{meetingState.platform}</span>
                </div>
              </div>
            )}

                                                                                                                                                                                              
            {!meetingState.isRecording ? (
              <button
                onClick={handleStartRecording}
                className="w-full py-3 rounded-full font-medium flex items-center justify-center gap-2 text-black"
                style={{ background: '#F3BA50' }}
              >
                <Mic className="w-4 h-4" />
                Start Recording
              </button>
            ) : (
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-sm mb-1" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Recording in progress</div>
                  <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Audio is being recorded and sent to Crownie</div>

                  <div className="flex items-center justify-center gap-1 my-3">
                    <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#F3BA50' }}></div>
                    <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#F3BA50', animationDelay: '0.2s' }}></div>
                    <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#F3BA50', animationDelay: '0.4s' }}></div>
                  </div>
                  
                  {meetingState.duration > 0 && (
                    <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                      Duration: {formatDuration(meetingState.duration)}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleStopRecording}
                  className="w-full bg-transparent border py-3 rounded-full font-medium flex items-center justify-center gap-2"
                  style={{ borderColor: '#F3BA50', color: '#F3BA50' }}
                >
                  <MicOff className="w-4 h-4" />
                  Stop Recording
                </button>
              </div>
            )}

            {/* Meeting Code */}
            {meetingCode && (
              <div className="rounded-lg p-3 text-center border" style={{ background: 'rgba(0, 0, 0, 0.4)', borderColor: 'rgba(243, 186, 80, 0.1)' }}>
                <div className="text-xs mb-1" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Meeting Code</div>
                <div className="text-sm font-mono text-white">{meetingCode}</div>
              </div>
            )}
          </div>
        ) : (
          /* No Meeting Detected - Platform Selection UI */
          <div className="space-y-3 w-full overflow-y-auto">
            {/* Status Circle */}
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center mb-2" style={{ borderColor: 'rgba(243, 186, 80, 0.5)' }}>
                <X className="w-5 h-5" style={{ color: 'rgba(243, 186, 80, 0.5)' }} />
              </div>
            </div>

            {/* Status Text */}
            <h2 className="text-base font-medium text-center mb-3">No meeting detected</h2>

            {/* Platform Buttons - Compact Layout */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 px-2 py-2 border rounded-lg" style={{ borderColor: 'rgba(243, 186, 80, 0.3)' }}>
                <img src={googleMeetIcon} alt="Google Meet" className="w-4 h-4" />
                <span className="text-xs">Google Meet</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-2 border rounded-lg" style={{ borderColor: 'rgba(243, 186, 80, 0.3)' }}>
                <img src={zoomIcon} alt="Zoom" className="w-4 h-4" />
                <span className="text-xs">Zoom</span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-2 py-2 border rounded-lg" style={{ borderColor: 'rgba(243, 186, 80, 0.3)' }}>
              <img src={teamsIcon} alt="Microsoft Teams" className="w-4 h-4" />
              <span className="text-xs">Microsoft Teams</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 px-2 py-2 border rounded-lg" style={{ borderColor: 'rgba(243, 186, 80, 0.3)' }}>
                <Phone className="w-4 h-4" style={{ color: '#F3BA50' }} />
                <span className="text-xs">Cisco Webex</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-2 border rounded-lg" style={{ borderColor: 'rgba(243, 186, 80, 0.3)' }}>
                <img src={discordIcon} alt="Discord" className="w-4 h-4" />
                <span className="text-xs">Discord</span>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex border-t" style={{ borderColor: 'rgba(243, 186, 80, 0.1)' }}>
        <button
          onClick={() => setCurrentView('orders')}
          className="flex-1 flex flex-col items-center gap-1 p-3 hover:bg-white/5 transition-colors"
        >
          <img src={ordersIcon} alt="Orders" className="w-4 h-4" />
          <span className="text-xs">Orders</span>
        </button>
        <button
          onClick={() => setCurrentView('history')}
          className="flex-1 flex flex-col items-center gap-1 p-3 hover:bg-white/5 transition-colors"
        >
          <img src={historyIcon} alt="History" className="w-4 h-4" />
          <span className="text-xs">History</span>
        </button>
      </div>
    </div>
  )
}

export default PopupView