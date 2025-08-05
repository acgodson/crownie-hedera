import React from 'react'
import { Routes, Route } from 'react-router-dom'
import PopupView from './components/PopupView'
import Dashboard from './components/Dashboard'
import MeetingHistory from './components/MeetingHistory'
import Settings from './components/Settings'
import AuthCallback from './components/AuthCallback'

const App: React.FC = () => {
  const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id

  return (
    <div className={`app ${isExtension ? 'extension-popup' : 'web-app'}`}>
      {isExtension ? (
        <Routes>
          <Route path="/" element={<PopupView />} />
          <Route path="/history" element={<MeetingHistory />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/popup" element={<PopupView />} />
          <Route path="/history" element={<MeetingHistory />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/auth-callback" element={<AuthCallback />} />
        </Routes>
      )}
    </div>
  )
}

export default App