import React from 'react'
import { Link } from 'react-router-dom'
import { useMeetingStore } from '../stores/meetingStore'
import { Settings, History, Mic, Users } from 'lucide-react'

const Dashboard: React.FC = () => {
  const { isRecording, platform, connectionStatus, currentMeeting, duration, transcript } = useMeetingStore()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎙️ IC Notetaker
          </h1>
          <p className="text-gray-600 text-lg">
            AI-Powered Meeting Notes
          </p>
        </header>

        {/* Connection Status */}
        <div className="max-w-md mx-auto mb-8">
          <div className={`p-4 rounded-lg text-center ${connectionStatus === 'connected'
              ? 'bg-green-100 text-green-800'
              : connectionStatus === 'connecting'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
            <div className="flex items-center justify-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected'
                  ? 'bg-green-500'
                  : connectionStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
                }`} />
              <span className="font-medium">
                {connectionStatus === 'connected' && 'Connected to IC'}
                {connectionStatus === 'connecting' && 'Connecting...'}
                {connectionStatus === 'disconnected' && 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* Current Meeting Status */}
          {isRecording && currentMeeting && (
            <div className="mb-8 p-6 bg-white rounded-xl shadow-lg border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">
                    Currently Recording
                  </h3>
                  <p className="text-gray-600">
                    {currentMeeting.title} • {platform}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-red-600">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="font-mono text-sm">
                    {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Extension Popup */}
            <Link to="/popup" className="card p-6 hover:shadow-xl transition-shadow group">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Mic className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-800">Extension View</h3>
              </div>
              <p className="text-gray-600 text-sm">
                View the extension popup interface for recording meetings
              </p>
            </Link>

            {/* Meeting History */}
            <Link to="/history" className="card p-6 hover:shadow-xl transition-shadow group">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <History className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-800">Meeting History</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Browse past meetings, transcripts, and summaries
              </p>
            </Link>

            {/* Settings */}
            <Link to="/settings" className="card p-6 hover:shadow-xl transition-shadow group">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <Settings className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-800">Settings</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Configure IC connection, audio settings, and preferences
              </p>
            </Link>
          </div>

          {/* Recent Activity */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Recent Activity
            </h3>
            {transcript.length > 0 ? (
              <div className="space-y-3">
                {transcript.slice(-3).map((segment) => (
                  <div key={segment.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">{segment.text}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(segment.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No recent meeting activity</p>
                <p className="text-sm">Start recording a meeting to see transcripts here</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center mt-12 text-gray-500 text-sm">
          <p>Built on the Internet Computer • Powered by AI</p>
        </footer>
      </div>
    </div>
  )
}

export default Dashboard