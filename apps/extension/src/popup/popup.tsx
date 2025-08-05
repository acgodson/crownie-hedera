import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import browser from 'webextension-polyfill'
import '../styles/popup.css'

interface MeetingState {
  isRecording: boolean
  meetingId?: string
  platform?: string
  duration: number
}

interface AuthState {
  isAuthenticated: boolean
  principalText?: string
  isLoading: boolean
  error?: string
}

const Popup: React.FC = () => {
  const [meetingState, setMeetingState] = useState<MeetingState>({
    isRecording: false,
    duration: 0
  })
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true
  })
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')

  useEffect(() => {
    // Check authentication status
    checkAuthStatus()
    
    // Check if we're on a supported meeting platform
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (tab?.url) {
        const platform = detectMeetingPlatform(tab.url)
        if (platform) {
          setMeetingState(prev => ({ ...prev, platform }))
        }
      }
    })
  }, [])

  // Update connection status when auth state changes
  useEffect(() => {
    checkConnectionStatus()
  }, [authState.isAuthenticated])

  const detectMeetingPlatform = (url: string): string | null => {
    if (url.includes('meet.google.com')) return 'Google Meet'
    if (url.includes('zoom.us')) return 'Zoom'
    if (url.includes('teams.microsoft.com')) return 'Microsoft Teams'
    if (url.includes('webex.com')) return 'Webex'
    if (url.includes('discord.com')) return 'Discord'
    return null
  }

  const checkAuthStatus = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))
      
      const response = await browser.runtime.sendMessage({ action: 'CHECK_AUTH_STATUS' }) as {
        isAuthenticated?: boolean
        principalText?: string
      } | undefined
      
      setAuthState({
        isAuthenticated: response?.isAuthenticated || false,
        principalText: response?.principalText,
        isLoading: false,
        error: undefined
      })
    } catch (error) {
      console.error('Failed to check auth status:', error)
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to check authentication'
      })
    }
  }

  const handleLogin = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: undefined }))
      
      const response = await browser.runtime.sendMessage({ action: 'LOGIN' }) as {
        success?: boolean
        error?: string
      } | undefined
      
      if (response?.success) {
        // Start polling for auth completion
        const pollInterval = setInterval(async () => {
          const authResponse = await browser.runtime.sendMessage({ action: 'CHECK_AUTH_STATUS' }) as {
            isAuthenticated?: boolean
            principalText?: string
          } | undefined
          if (authResponse?.isAuthenticated) {
            clearInterval(pollInterval)
            setAuthState({
              isAuthenticated: true,
              principalText: authResponse.principalText,
              isLoading: false,
              error: undefined
            })
          }
        }, 2000)

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000)
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: response?.error || 'Login failed'
        }))
      }
    } catch (error) {
      console.error('Login failed:', error)
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }))
    }
  }

  const handleLogout = async () => {
    try {
      await browser.runtime.sendMessage({ action: 'LOGOUT' })
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        error: undefined
      })
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const checkConnectionStatus = async () => {
    setConnectionStatus('connecting')
    try {
      // Check auth status to determine connection
      if (authState.isAuthenticated) {
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('disconnected')
      }
    } catch (error) {
      setConnectionStatus('disconnected')
    }
  }

  const startRecording = async () => {
    try {
      // Send message to content script to start recording
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab.id) {
        await chrome.tabs.sendMessage(tab.id, { action: 'START_RECORDING' })
        setMeetingState(prev => ({ ...prev, isRecording: true }))
      }
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const stopRecording = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab.id) {
        await chrome.tabs.sendMessage(tab.id, { action: 'STOP_RECORDING' })
        setMeetingState(prev => ({ ...prev, isRecording: false, duration: 0 }))
      }
    } catch (error) {
      console.error('Failed to stop recording:', error)
    }
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="logo">
          <h2>🎙️ IC Notetaker</h2>
        </div>
        <div className={`connection-status ${connectionStatus}`}>
          <div className="status-dot"></div>
          <span>
            {authState.isAuthenticated
              ? `Authenticated (${authState.principalText?.slice(0, 10)}...)`
              : authState.isLoading
              ? 'Checking auth...'
              : 'Not authenticated'
            }
          </span>
        </div>
      </header>

      <main className="popup-main">
        {!authState.isAuthenticated ? (
          <div className="auth-section">
            <div className="auth-status">
              <h3>Authentication Required</h3>
              <p>Sign in with Internet Identity to record meetings</p>
              {authState.error && (
                <p className="error-message">{authState.error}</p>
              )}
            </div>
            <div className="auth-controls">
              <button 
                className="auth-button login" 
                onClick={handleLogin}
                disabled={authState.isLoading}
              >
                {authState.isLoading ? 'Authenticating...' : 'Login with Internet Identity'}
              </button>
            </div>
          </div>
        ) : meetingState.platform ? (
          <div className="meeting-section">
            <div className="platform-info">
              <span className="platform-badge">{meetingState.platform}</span>
              <span className="meeting-detected">Meeting detected</span>
            </div>
            
            <div className="recording-controls">
              {!meetingState.isRecording ? (
                <button 
                  className="record-button start" 
                  onClick={startRecording}
                  disabled={!authState.isAuthenticated}
                >
                  <span className="record-icon">⚫</span>
                  Start Recording
                </button>
              ) : (
                <div className="recording-active">
                  <button className="record-button stop" onClick={stopRecording}>
                    <span className="record-icon">⏹️</span>
                    Stop Recording
                  </button>
                  <div className="recording-info">
                    <div className="recording-indicator">
                      <span className="pulse-dot"></span>
                      Recording: {formatDuration(meetingState.duration)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {meetingState.meetingId && (
              <div className="meeting-info">
                <p className="meeting-id">Meeting ID: {meetingState.meetingId}</p>
                <button className="view-transcript">View Transcript</button>
              </div>
            )}
          </div>
        ) : (
          <div className="no-meeting">
            <div className="no-meeting-icon">🚫</div>
            <h3>No meeting detected</h3>
            <p>Navigate to a supported meeting platform:</p>
            <ul className="supported-platforms">
              <li>Google Meet</li>
              <li>Zoom</li>
              <li>Microsoft Teams</li>
              <li>Webex</li>
              <li>Discord</li>
            </ul>
          </div>
        )}
      </main>

      <footer className="popup-footer">
        <div className="footer-links">
          {authState.isAuthenticated && (
            <button className="link-button" onClick={handleLogout}>Logout</button>
          )}
          <button className="link-button">Settings</button>
          <button className="link-button">History</button>
          <button className="link-button">Help</button>
        </div>
      </footer>
    </div>
  )
}

const root = ReactDOM.createRoot(document.getElementById('popup-root')!)
root.render(<Popup />)