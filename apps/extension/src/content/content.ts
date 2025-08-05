console.log('🔧 Crownie Content Script: Starting...')

// Detect the platform based on current URL
function detectPlatform(): string | null {
  const url = window.location.href
  if (url.includes('meet.google.com')) return 'Google Meet'
  if (url.includes('zoom.us')) return 'Zoom'
  if (url.includes('teams.microsoft.com')) return 'Microsoft Teams'
  if (url.includes('webex.com')) return 'Cisco Webex'
  if (url.includes('discord.com')) return 'Discord'
  return null
}

// Check if we're in an active meeting
function isMeetingActive(): boolean {
  const platform = detectPlatform()
  
  switch (platform) {
    case 'Google Meet':
      // Check for meeting UI elements
      return !!(
        document.querySelector('[data-meeting-title]') ||
        document.querySelector('[jsname="A5il2e"]') ||
        document.querySelector('.uArJ5e.UQuaGc.kCyAyd.l3F1ye.ARrCac.HvOprf') ||
        document.querySelector('[aria-label*="Turn camera"]') ||
        document.querySelector('[aria-label*="Mute"]')
      )
    
    case 'Zoom':
      return !!(
        document.querySelector('#root') ||
        document.querySelector('.meeting-app') ||
        document.querySelector('[title*="mute"]') ||
        document.querySelector('[title*="camera"]')
      )
    
    case 'Microsoft Teams':
      return !!(
        document.querySelector('[data-tid="toggle-mute"]') ||
        document.querySelector('[data-tid="toggle-video"]') ||
        document.querySelector('.ts-calling-screen')
      )
    
    case 'Cisco Webex':
      return !!(
        document.querySelector('[data-testid="mute-audio-button"]') ||
        document.querySelector('[data-testid="mute-video-button"]') ||
        document.querySelector('.meeting-controls')
      )
    
    case 'Discord':
      return !!(
        document.querySelector('[aria-label*="Mute"]') ||
        document.querySelector('[aria-label*="Deafen"]') ||
        document.querySelector('.panels-3wFtMD')
      )
    
    default:
      return false
  }
}

// Get meeting metadata
function getMeetingInfo() {
  const platform = detectPlatform()
  const isActive = isMeetingActive()
  
  let meetingId = ''
  let title = ''
  
  if (platform === 'Google Meet') {
    const urlMatch = window.location.pathname.match(/\/([a-z\-]+)$/)
    meetingId = urlMatch ? urlMatch[1] : ''
    title = document.title || `Google Meet - ${meetingId}`
  } else if (platform === 'Zoom') {
    meetingId = new URLSearchParams(window.location.search).get('confno') || 
               window.location.pathname.split('/').pop() || ''
    title = document.title || `Zoom Meeting - ${meetingId}`
  } else if (platform === 'Microsoft Teams') {
    meetingId = new URLSearchParams(window.location.search).get('threadId') || 
               Math.random().toString(36).substr(2, 9)
    title = document.title || `Teams Meeting - ${meetingId}`
  }
  
  return {
    platform,
    isActive,
    meetingId,
    title,
    url: window.location.href
  }
}

// Message handler for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🔍 Content Script: Received message:', message)
  
  switch (message.action) {
    case 'GET_MEETING_STATUS':
      const meetingInfo = getMeetingInfo()
      console.log('🔍 Content Script: Meeting info:', meetingInfo)
      sendResponse({
        isMeetingDetected: !!meetingInfo.platform && meetingInfo.isActive,
        platform: meetingInfo.platform || 'Unknown',
        meetingId: meetingInfo.meetingId,
        title: meetingInfo.title,
        isRecording: false, // Will be managed by background script
        recordingDuration: 0
      })
      break
    
    case 'START_RECORDING':
      console.log('🔍 Content Script: Start recording requested')
      // In a real implementation, this would start audio capture
      sendResponse({ success: true, message: 'Recording started' })
      break
    
    case 'STOP_RECORDING':
      console.log('🔍 Content Script: Stop recording requested')
      // In a real implementation, this would stop audio capture
      sendResponse({ success: true, message: 'Recording stopped' })
      break
    
    default:
      sendResponse({ error: `Unknown action: ${message.action}` })
  }
  
  return true // Keep message channel open for async response
})

// Initialize and send meeting detection to background
function initializeContentScript() {
  const meetingInfo = getMeetingInfo()
  
  if (meetingInfo.platform) {
    console.log(`✅ Crownie Content Script: Detected ${meetingInfo.platform}`)
    
    // Notify background script of meeting detection
    chrome.runtime.sendMessage({
      action: 'MEETING_DETECTED',
      data: meetingInfo
    }).catch(error => {
      console.log('Background script not ready:', error)
    })
  } else {
    console.log('❌ Crownie Content Script: No supported meeting platform detected')
  }
}

// Wait for page to load then initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript)
} else {
  initializeContentScript()
}

// Monitor for dynamic content changes (SPA navigation)
let currentUrl = window.location.href
setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href
    console.log('🔍 Content Script: URL changed, re-initializing...')
    setTimeout(initializeContentScript, 1000) // Delay for page to load
  }
}, 1000)

console.log('✅ Crownie Content Script: Initialized successfully')