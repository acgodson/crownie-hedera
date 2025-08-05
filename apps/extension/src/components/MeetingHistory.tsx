import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  FileText, 
  Search, 
  Filter,
  Download,
  ExternalLink,
  Loader
} from 'lucide-react'

interface Meeting {
  meeting_id: string
  title: string | null
  status: 'Active' | 'Ended' | 'Failed'
  created_at: number
  ended_at: number | null
  segment_count: number
  has_summary: boolean
}

const MeetingHistory: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'Active' | 'Ended' | 'Failed'>('all')

  // Fetch meetings from IC canister
  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setLoading(true)
        const response = await chrome.runtime.sendMessage({
          action: 'GET_MEETINGS',
          data: { offset: 0, limit: 50 }
        })
        
        if (response.error) {
          setError(response.error)
        } else {
          setMeetings(response || [])
        }
      } catch (err) {
        setError('Failed to fetch meetings')
        console.error('Error fetching meetings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMeetings()
  }, [])

  const filteredMeetings = meetings.filter(meeting => {
    const title = meeting.title || 'Untitled Meeting'
    const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         meeting.meeting_id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filter === 'all' || meeting.status === filter
    return matchesSearch && matchesFilter
  })

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp / 1000000) // Convert nanoseconds to milliseconds
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const calculateDuration = (startTime: number, endTime: number | null): number => {
    if (!endTime) return 0
    return Math.floor((endTime - startTime) / 1000000000) // Convert nanoseconds to seconds
  }

  const getStatusColor = (status: Meeting['status']) => {
    switch (status) {
      case 'Ended':
        return 'bg-green-100 text-green-800'
      case 'Active':
        return 'bg-blue-100 text-blue-800'
      case 'Failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPlatformFromTitle = (title: string | null): string => {
    if (!title) return 'Unknown Platform'
    const titleLower = title.toLowerCase()
    if (titleLower.includes('meet')) return 'Google Meet'
    if (titleLower.includes('zoom')) return 'Zoom'
    if (titleLower.includes('teams')) return 'Microsoft Teams'
    if (titleLower.includes('webex')) return 'Webex'
    if (titleLower.includes('discord')) return 'Discord'
    return 'Unknown Platform'
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'Google Meet':
        return 'bg-green-100 text-green-800'
      case 'Zoom':
        return 'bg-blue-100 text-blue-800'
      case 'Microsoft Teams':
        return 'bg-purple-100 text-purple-800'
      case 'Webex':
        return 'bg-orange-100 text-orange-800'
      case 'Discord':
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="h-full flex flex-col gradient-bg text-white">
      {/* Header */}
      <header className="p-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <Link to="/" className="p-1 hover:bg-white/10 rounded transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-sm font-semibold">Meeting History</h1>
        </div>
        
        {/* Compact Search */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-white/50" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-2 py-1 text-xs bg-white/10 border border-white/20 rounded text-white placeholder-white/50 focus:outline-none focus:bg-white/20"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-2 py-1 text-xs bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:bg-white/20"
          >
            <option value="all">All</option>
            <option value="Ended">Done</option>
            <option value="Active">Live</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
      </header>

      {/* Meeting List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="text-center py-8">
            <Loader className="w-5 h-5 mx-auto mb-2 text-white animate-spin" />
            <p className="text-xs text-white/70">Loading...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 mx-auto mb-2 text-white/50" />
            <p className="text-xs text-white/70">Error loading meetings</p>
          </div>
        ) : filteredMeetings.length > 0 ? (
          filteredMeetings.map((meeting) => {
            const platform = getPlatformFromTitle(meeting.title)
            const duration = calculateDuration(meeting.created_at, meeting.ended_at)
            
            return (
              <div key={meeting.meeting_id} className="bg-white/10 rounded-lg p-3 hover:bg-white/20 transition-colors">
                {/* Title Line */}
                <h3 className="text-sm font-medium text-white mb-2 truncate">
                  {meeting.title || 'Untitled Meeting'}
                </h3>
                
                {/* Status and Actions Line */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(meeting.status)}`}>
                      {meeting.status}
                    </span>
                    <span className="text-white/70">
                      {formatDate(meeting.created_at)}
                    </span>
                    {meeting.ended_at && (
                      <span className="text-white/70">
                        {formatDuration(duration)}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button 
                      className={`p-1 rounded transition-colors ${
                        meeting.has_summary 
                          ? 'text-white/70 hover:text-white hover:bg-white/10' 
                          : 'text-white/30 opacity-50 cursor-not-allowed'
                      }`}
                      disabled={!meeting.has_summary}
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors">
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 mx-auto mb-2 text-white/50" />
            <p className="text-xs text-white/70">No meetings found</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default MeetingHistory