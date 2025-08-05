import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
  DollarSign,
  Clock,
  Wallet,
  Loader
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useMeetingStore } from '../stores/meetingStore'
import logo from '../assets/logo.png'
import googleMeetIcon from '../assets/google_meet.png'
import zoomIcon from '../assets/zoom.png'
import teamsIcon from '../assets/teams.png'
import discordIcon from '../assets/discord.png'
import ordersIcon from '../assets/orders.png'
import historyIcon from '../assets/history.png'

const PopupView: React.FC = () => {
  const {
    isRecording,
    platform,
    duration,
    createMeeting,
    stopRecording,
    detectPlatform,
    getActiveOrders
  } = useMeetingStore()

  const [currentView, setCurrentView] = useState<'main' | 'orders' | 'history'>('main')
  const [meetingDetected, setMeetingDetected] = useState(false)
  const [meetingCode, setMeetingCode] = useState('')

  useEffect(() => {
    // Check if we're on a meeting platform
    const detectedPlatform = detectPlatform()
    setMeetingDetected(!!detectedPlatform)

    // Generate mock meeting code if detected
    if (detectedPlatform) {
      setMeetingCode(Math.floor(Math.random() * 900000000000) + 100000000000 + '')
    }
  }, [detectPlatform])

  const handleStartRecording = async () => {
    try {
      await createMeeting()
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const handleStopRecording = () => {
    stopRecording()
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

  const mockOrders = [
    {
      id: '7844245',
      fromAmount: '2.5',
      fromToken: 'ETH',
      toAmount: '800',
      toToken: 'ICP',
      rate: '320',
      status: 'pending'
    },
    {
      id: '4521245',
      fromAmount: '1,000',
      fromToken: 'ICP',
      toAmount: '0.00125',
      toToken: 'ETH',
      rate: '0.00125',
      status: 'fulfilled'
    },
    {
      id: '1021426',
      fromAmount: '5',
      fromToken: 'ETH',
      toAmount: '780',
      toToken: 'ICP',
      rate: '156',
      status: 'pending'
    }
  ]

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
      <div className="w-80 h-96 bg-crownie-dark text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentView('main')} className="p-1 hover:bg-gray-800 rounded">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="font-medium">Orders</span>
          </div>
          {/* <div className="flex items-center gap-2">
            <img src={logo} alt="Crownie" className="w-6 h-6" />
            <span className="text-xs text-gray-400">{address?.slice(0, 4)}...{address?.slice(-4)}</span>
          </div> */}
        </div>

        {/* Orders List */}
        <div className="p-4 space-y-3 overflow-y-auto h-80">
          {mockOrders.map((order) => (
            <div key={order.id} className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white font-medium">
                  {order.fromAmount} {order.fromToken}
                </div>
                <div className="text-xs text-gray-400">ID: {order.id}</div>
              </div>

              <div className="text-xs text-gray-400 mb-2">
                Limit price: 1 {order.fromToken} = {order.rate} {order.toToken}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white">{order.fromToken[0]}</span>
                  </div>
                  <ArrowLeft className="w-3 h-3 text-gray-500 rotate-180" />
                  <div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white">{order.toToken[0]}</span>
                  </div>
                </div>

                {order.status === 'pending' ? (
                  <button className="bg-crownie-primary text-crownie-dark px-3 py-1 rounded text-xs font-medium">
                    Fulfill Order
                  </button>
                ) : (
                  <span className="text-green-400 text-xs">Order Fulfilled</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (currentView === 'history') {
    return (
      <div className="w-80 h-96 bg-crownie-dark text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentView('main')} className="p-1 hover:bg-gray-800 rounded">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="font-medium">Meeting History</span>
          </div>
          {/* <div className="flex items-center gap-2">
            <img src={logo} alt="Crownie" className="w-6 h-6" />
            <span className="text-xs text-gray-400">{address?.slice(0, 4)}...{address?.slice(-4)}</span> 
          </div> */}
        </div>

        {/* History List */}
        <div className="p-4 space-y-3 overflow-y-auto h-80">
          {mockMeetings.map((meeting) => (
            <div key={meeting.id} className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">{meeting.title}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${meeting.status === 'Ongoing'
                    ? 'bg-yellow-500 text-crownie-dark'
                    : 'bg-green-500 text-white'
                    }`}>
                    {meeting.status}
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-400 mb-2">
                {meeting.date} {meeting.duration}
              </div>

              <div className="flex items-center gap-2">
                <button className="text-crownie-primary text-xs hover:underline">
                  Download
                </button>
                <button className="text-crownie-primary text-xs hover:underline">
                  Share
                </button>
              </div>
            </div>
          ))}
        </div>
      </div >
    )
  }

  return (
    <div className="w-80 h-96 bg-crownie-dark text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Crownie" className="w-6 h-6" />
          <span className="font-medium">Crownie</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">disconnected</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {meetingDetected ? (
          <div className="space-y-4 w-full">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full border-2 border-crownie-primary bg-crownie-primary/10 flex items-center justify-center mb-4">
                <Check className="w-6 h-6 text-crownie-primary" />
              </div>
            </div>

            <h2 className="text-lg font-medium text-center">Meeting Detected</h2>

            {platform && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 px-3 py-1 bg-crownie-primary/20 border border-crownie-primary/30 rounded-full">
                  {getPlatformIcon(platform)}
                  <span className="text-sm text-crownie-primary">{platform}</span>
                </div>
              </div>
            )}

                                                                                                                                                                                              
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                className="w-full bg-crownie-primary text-crownie-dark py-3 rounded-full font-medium flex items-center justify-center gap-2"
              >
                <Mic className="w-4 h-4" />
                Start Recording
              </button>
            ) : (
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-sm text-gray-400 mb-1">Recording in progress</div>
                  <div className="text-xs text-gray-500">Audio is being recorded and sent to Crownie</div>

                  <div className="flex items-center justify-center gap-1 my-3">
                    <div className="w-1 h-1 bg-crownie-primary rounded-full animate-pulse"></div>
                    <div className="w-1 h-1 bg-crownie-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1 h-1 bg-crownie-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>

                <button
                  onClick={handleStopRecording}
                  className="w-full bg-transparent border border-crownie-primary text-crownie-primary py-3 rounded-full font-medium flex items-center justify-center gap-2"
                >
                  <MicOff className="w-4 h-4" />
                  Stop Recording
                </button>
              </div>
            )}

            {/* Meeting Code */}
            {meetingCode && (
              <div className="bg-gray-900 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Meeting Code</div>
                <div className="text-sm font-mono text-white">{meetingCode}</div>
              </div>
            )}
          </div>
        ) : (
          /* No Meeting Detected - Platform Selection UI */
          <div className="space-y-4 w-full">
            {/* Status Circle */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full border-2 border-crownie-primary/50 flex items-center justify-center mb-4">
                <X className="w-6 h-6 text-crownie-primary/50" />
              </div>
            </div>

            {/* Status Text */}
            <h2 className="text-lg font-medium text-center mb-4">No meeting detected</h2>

            {/* Platform Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 px-3 py-2 border border-crownie-primary/30 rounded-lg">
                <img src={googleMeetIcon} alt="Google Meet" className="w-4 h-4" />
                <span className="text-sm">Google Meet</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 border border-crownie-primary/30 rounded-lg">
                <img src={zoomIcon} alt="Zoom" className="w-4 h-4" />
                <span className="text-sm">Zoom</span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 border border-crownie-primary/30 rounded-lg">
              <img src={teamsIcon} alt="Microsoft Teams" className="w-4 h-4" />
              <span className="text-sm">Microsoft Teams</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 px-3 py-2 border border-crownie-primary/30 rounded-lg">
                <Phone className="w-4 h-4 text-crownie-primary" />
                <span className="text-sm">Cisco Webex</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 border border-crownie-primary/30 rounded-lg">
                <img src={discordIcon} alt="Discord" className="w-4 h-4" />
                <span className="text-sm">Discord</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="flex border-t border-gray-800">
        <button
          onClick={() => setCurrentView('orders')}
          className="flex-1 flex flex-col items-center gap-1 p-3 hover:bg-gray-900 transition-colors"
        >
          <img src={ordersIcon} alt="Orders" className="w-4 h-4" />
          <span className="text-xs">Orders</span>
        </button>
        <button
          onClick={() => setCurrentView('history')}
          className="flex-1 flex flex-col items-center gap-1 p-3 hover:bg-gray-900 transition-colors"
        >
          <img src={historyIcon} alt="History" className="w-4 h-4" />
          <span className="text-xs">History</span>
        </button>
      </div>
    </div>
  )
}

export default PopupView