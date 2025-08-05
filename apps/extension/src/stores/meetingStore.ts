import { create } from 'zustand'

interface TranscriptSegment {
  id: string
  text: string
  timestamp: number
  speaker?: string
}

interface SwapIntent {
  id: string
  from: string
  to: string
  amount: string
  fromToken: string
  toToken: string
  rate: string
  status: 'pending' | 'active' | 'fulfilled' | 'cancelled'
  createdAt: number
  meetingId: string
  escrowAddress?: string
  secretHash?: string
}

interface Meeting {
  id: string
  title: string
  platform: string
  startTime: number
  endTime?: number
  status: 'active' | 'ended'
  summary?: string
  aiNotes?: string[]
  intents: SwapIntent[]
}

interface MeetingState {
  // State
  isRecording: boolean
  meetingId?: string
  platform?: string
  duration: number
  connectionStatus: 'connected' | 'connecting' | 'disconnected'
  transcript: TranscriptSegment[]
  currentMeeting?: Meeting
  meetings: Meeting[]
  activeOrders: SwapIntent[]
  error: string | null

  // Actions
  startRecording: (meetingId: string, platform: string) => void
  stopRecording: () => void
  updateDuration: (duration: number) => void
  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected') => void
  addTranscript: (segment: TranscriptSegment) => void
  setPlatform: (platform: string) => void
  setCurrentMeeting: (meeting: Meeting) => void
  detectPlatform: () => string | null
  checkConnection: () => Promise<void>
  createMeeting: () => Promise<void>
  addMeeting: (meeting: Meeting) => void
  generateIntentFromNotes: (notes: string[]) => SwapIntent[]
  addIntent: (intent: SwapIntent) => void
  updateIntentStatus: (intentId: string, status: SwapIntent['status']) => void
  getActiveOrders: () => SwapIntent[]
  clearError: () => void
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  // Initial state
  isRecording: false,
  duration: 0,
  connectionStatus: 'disconnected',
  transcript: [],
  meetings: [],
  activeOrders: [],
  error: null,

  clearError: () => set({ error: null }),

  startRecording: (meetingId: string, platform: string) => {
    set({
      isRecording: true,
      meetingId,
      platform,
      duration: 0,
      error: null
    })
  },

  stopRecording: () => {
    const { currentMeeting } = get()
    if (currentMeeting) {
      // End the current meeting
      const updatedMeeting = {
        ...currentMeeting,
        status: 'ended' as const,
        endTime: Date.now(),
      }
      get().addMeeting(updatedMeeting)
    }
    
    set({
      isRecording: false,
      duration: 0,
      currentMeeting: undefined
    })
  },

  updateDuration: (duration: number) => {
    set({ duration })
  },

  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected') => {
    set({ connectionStatus: status })
  },

  addTranscript: (segment: TranscriptSegment) => {
    set(state => ({
      transcript: [...state.transcript, segment]
    }))
  },

  setPlatform: (platform: string) => {
    set({ platform })
  },

  setCurrentMeeting: (meeting: Meeting) => {
    set({ currentMeeting: meeting })
  },

  addMeeting: (meeting: Meeting) => {
    set(state => ({
      meetings: [meeting, ...state.meetings.filter(m => m.id !== meeting.id)]
    }))
  },

  generateIntentFromNotes: (notes: string[]): SwapIntent[] => {
    // AI-powered intent generation from meeting notes
    const intents: SwapIntent[] = []
    
    notes.forEach((note, index) => {
      // Simple pattern matching for swap intents
      // In production, this would use actual AI/NLP
      const swapPatterns = [
        /(\d+(?:\.\d+)?)\s*(ETH|BTC|USDC|ICP)\s*(?:for|to|→)\s*(\d+(?:\.\d+)?)\s*(ETH|BTC|USDC|ICP)/gi,
        /swap\s*(\d+(?:\.\d+)?)\s*(ETH|BTC|USDC|ICP)\s*for\s*(\d+(?:\.\d+)?)\s*(ETH|BTC|USDC|ICP)/gi,
        /exchange\s*(\d+(?:\.\d+)?)\s*(ETH|BTC|USDC|ICP)\s*to\s*(\d+(?:\.\d+)?)\s*(ETH|BTC|USDC|ICP)/gi
      ]
      
      swapPatterns.forEach(pattern => {
        const matches = note.matchAll(pattern)
        for (const match of matches) {
          const [, fromAmount, fromToken, toAmount, toToken] = match
          if (fromAmount && fromToken && toAmount && toToken) {
            const intent: SwapIntent = {
              id: `intent_${Date.now()}_${index}`,
              from: '0x' + Math.random().toString(16).slice(2, 42), // Mock address
              to: '0x' + Math.random().toString(16).slice(2, 42), // Mock address
              amount: fromAmount,
              fromToken: fromToken.toUpperCase(),
              toToken: toToken.toUpperCase(),
              rate: (parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4),
              status: 'pending',
              createdAt: Date.now(),
              meetingId: get().meetingId || 'unknown'
            }
            intents.push(intent)
          }
        }
      })
    })
    
    return intents
  },

  addIntent: (intent: SwapIntent) => {
    set(state => ({
      activeOrders: [...state.activeOrders, intent]
    }))
  },

  updateIntentStatus: (intentId: string, status: SwapIntent['status']) => {
    set(state => ({
      activeOrders: state.activeOrders.map(order => 
        order.id === intentId ? { ...order, status } : order
      )
    }))
  },

  getActiveOrders: () => {
    const { activeOrders } = get()
    return activeOrders.filter(order => ['pending', 'active'].includes(order.status))
  },

  detectPlatform: (): string | null => {
    if (typeof window === 'undefined') return null
    
    const url = window.location.href
    if (url.includes('meet.google.com')) return 'Google Meet'
    if (url.includes('zoom.us')) return 'Zoom'
    if (url.includes('teams.microsoft.com')) return 'Microsoft Teams'
    if (url.includes('webex.com')) return 'Cisco Webex'  
    if (url.includes('discord.com')) return 'Discord'
    return null
  },

  checkConnection: async () => {
    set({ connectionStatus: 'connecting', error: null })
    
    try {
      // Check if running as extension
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        // Send health check message to background script
        const response = await chrome.runtime.sendMessage({ action: 'HEALTH_CHECK' })
        console.log('🔍 MeetingStore: Health check response:', response)
        
        if (response && !response.error) {
          set({ connectionStatus: 'connected' })
        } else {
          set({ connectionStatus: 'disconnected', error: 'Health check failed' })
        }
      } else {
        // Running as web app - simulate connection
        setTimeout(() => {
          set({ connectionStatus: 'connected' })
        }, 1000)
      }
    } catch (error) {
      console.error('❌ MeetingStore: Connection check failed:', error)
      set({ 
        connectionStatus: 'disconnected',
        error: error instanceof Error ? error.message : 'Connection check failed'
      })
    }
  },

  createMeeting: async () => {
    try {
      const { platform } = get()
      set({ error: null })

      const meetingId = `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const meeting: Meeting = {
        id: meetingId,
        title: `${platform || 'Unknown Platform'} Meeting`,
        platform: platform || 'Unknown',
        startTime: Date.now(),
        status: 'active',
        intents: []
      }

      get().setCurrentMeeting(meeting)
      get().startRecording(meetingId, platform || 'Unknown')
      
      console.log('✅ MeetingStore: Meeting created:', meetingId)
    } catch (error) {
      console.error('❌ MeetingStore: Failed to create meeting:', error)
      set({ error: error instanceof Error ? error.message : 'Failed to create meeting' })
      throw error
    }
  }
}))

// Initialize platform detection and connection check
if (typeof window !== 'undefined') {
  // Auto-detect platform on load
  const platform = useMeetingStore.getState().detectPlatform()
  if (platform) {
    useMeetingStore.getState().setPlatform(platform)
  }

  // Check connection on load
  useMeetingStore.getState().checkConnection()
}