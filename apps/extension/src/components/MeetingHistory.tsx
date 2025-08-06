import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  FileText, 
  Search, 
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


  return (
    <div className="h-full flex flex-col text-white"
         style={{
           background: '#1a1a1a',
           backgroundImage: `
             linear-gradient(rgba(243, 186, 80, 0.03) 1px, transparent 1px),
             linear-gradient(90deg, rgba(243, 186, 80, 0.03) 1px, transparent 1px)
           `,
           backgroundSize: '20px 20px'
         }}>
      {/* Header */}
      <header className="p-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(243, 186, 80, 0.1)' }}>
        <div className="flex items-center gap-3 mb-2">
          <Link to="/" className="p-1 hover:bg-white/10 rounded transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-sm font-semibold">Meeting History</h1>
        </div>
        
        {/* Compact Search */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3" style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-2 py-1 text-xs border rounded text-white focus:outline-none"
              style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                borderColor: 'rgba(243, 186, 80, 0.2)',
                color: 'white'
              }}
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-2 py-1 text-xs border rounded text-white focus:outline-none"
            style={{ 
              background: 'rgba(255, 255, 255, 0.1)', 
              borderColor: 'rgba(243, 186, 80, 0.2)'
            }}
          >
            <option value="all" style={{ background: '#1a1a1a', color: 'white' }}>All</option>
            <option value="Ended" style={{ background: '#1a1a1a', color: 'white' }}>Done</option>
            <option value="Active" style={{ background: '#1a1a1a', color: 'white' }}>Live</option>
            <option value="Failed" style={{ background: '#1a1a1a', color: 'white' }}>Failed</option>
          </select>
        </div>
      </header>

      {/* Meeting List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="text-center py-8">
            <Loader className="w-5 h-5 mx-auto mb-2 animate-spin" style={{ color: '#F3BA50' }} />
            <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Loading...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
            <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Error loading meetings</p>
          </div>
        ) : filteredMeetings.length > 0 ? (
          filteredMeetings.map((meeting) => {
            const platform = getPlatformFromTitle(meeting.title)
            const duration = calculateDuration(meeting.created_at, meeting.ended_at)
            
            return (
              <div key={meeting.meeting_id} className="rounded-lg p-3 transition-colors border"
                   style={{ 
                     background: 'rgba(0, 0, 0, 0.4)', 
                     borderColor: 'rgba(243, 186, 80, 0.1)',
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
                     e.currentTarget.style.borderColor = 'rgba(243, 186, 80, 0.2)';
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
                     e.currentTarget.style.borderColor = 'rgba(243, 186, 80, 0.1)';
                   }}>
                {/* Title Line */}
                <h3 className="text-sm font-medium text-white mb-2 truncate">
                  {meeting.title || 'Untitled Meeting'}
                </h3>
                
                {/* Status and Actions Line */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium`}
                          style={{ 
                            background: meeting.status === 'Ended' ? '#10b981' : meeting.status === 'Active' ? '#F3BA50' : '#ef4444',
                            color: meeting.status === 'Active' ? '#1a1a1a' : 'white'
                          }}>
                      {meeting.status}
                    </span>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {formatDate(meeting.created_at)}
                    </span>
                    {meeting.ended_at && (
                      <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {formatDuration(duration)}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button 
                      className={`p-1 rounded transition-colors ${
                        meeting.has_summary 
                          ? 'hover:bg-white/10' 
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      style={{ 
                        color: meeting.has_summary ? '#F3BA50' : 'rgba(255, 255, 255, 0.3)'
                      }}
                      disabled={!meeting.has_summary}
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button className="p-1 rounded transition-colors hover:bg-white/10"
                            style={{ color: '#F3BA50' }}>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
            <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>No meetings found</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default MeetingHistory