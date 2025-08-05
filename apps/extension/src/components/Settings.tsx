import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  Save, 
  RefreshCw, 
  Globe,
  Mic,
  Volume2,
  Bell,
  Shield,
  Info
} from 'lucide-react'

interface SettingsState {
  icNetwork: 'local' | 'ic'
  audioQuality: 'low' | 'medium' | 'high'
  autoSave: boolean
  notifications: boolean
  theme: 'light' | 'dark' | 'system'
  language: string
  privacy: {
    shareAnalytics: boolean
    storeLocally: boolean
  }
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsState>({
    icNetwork: 'local',
    audioQuality: 'medium',
    autoSave: true,
    notifications: true,
    theme: 'system',
    language: 'en',
    privacy: {
      shareAnalytics: false,
      storeLocally: true
    }
  })

  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const handleSave = async () => {
    setIsSaving(true)
    
    // Simulate saving to IC canister
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    setIsSaving(false)
    setLastSaved(new Date())
  }

  const handleReset = () => {
    setSettings({
      icNetwork: 'local',
      audioQuality: 'medium',
      autoSave: true,
      notifications: true,
      theme: 'system',
      language: 'en',
      privacy: {
        shareAnalytics: false,
        storeLocally: true
      }
    })
  }

  const updateSetting = (key: keyof SettingsState, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const updatePrivacySetting = (key: keyof SettingsState['privacy'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      privacy: {
        ...prev.privacy,
        [key]: value
      }
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
              <p className="text-gray-600">Configure your IC Notetaker preferences</p>
            </div>
          </div>

          {/* Save Controls */}
          <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reset to Defaults
              </button>
            </div>
            {lastSaved && (
              <p className="text-sm text-gray-500">
                Last saved: {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>
        </header>

        {/* Settings Content */}
        <div className="max-w-2xl mx-auto space-y-6">
          {/* IC Network Settings */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Internet Computer Network</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Network Environment
                </label>
                <select
                  value={settings.icNetwork}
                  onChange={(e) => updateSetting('icNetwork', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="local">Local Development</option>
                  <option value="ic">Internet Computer Mainnet</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {settings.icNetwork === 'local' 
                    ? 'Connect to local dfx replica for development'
                    : 'Connect to the Internet Computer mainnet'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Audio Settings */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Mic className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-800">Audio Settings</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recording Quality
                </label>
                <select
                  value={settings.audioQuality}
                  onChange={(e) => updateSetting('audioQuality', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Low (Faster processing)</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="high">High (Best accuracy)</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Auto-save recordings</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoSave}
                    onChange={(e) => updateSetting('autoSave', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-5 h-5 text-yellow-600" />
              <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">Enable notifications</span>
                  <p className="text-xs text-gray-500">Get notified when transcription is complete</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications}
                    onChange={(e) => updateSetting('notifications', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-800">Privacy & Data</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">Store data locally</span>
                  <p className="text-xs text-gray-500">Keep recordings on your device</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.privacy.storeLocally}
                    onChange={(e) => updatePrivacySetting('storeLocally', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">Share anonymous analytics</span>
                  <p className="text-xs text-gray-500">Help improve IC Notetaker</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.privacy.shareAnalytics}
                    onChange={(e) => updatePrivacySetting('shareAnalytics', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Info className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-800">About</h3>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>Version:</strong> 1.0.0</p>
              <p><strong>Build:</strong> Extension v1.0.0</p>
              <p><strong>Network:</strong> {settings.icNetwork === 'local' ? 'Local Development' : 'IC Mainnet'}</p>
              <p><strong>Canister ID:</strong> {process.env.VITE_IC_NOTETAKER_CANISTER_ID || 'Not connected'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings