import React, { useState, useEffect } from 'react'
import browser from 'webextension-polyfill'
import { Clock, Zap, ExternalLink, RefreshCw, MessageSquare } from 'lucide-react'

interface Message {
  sequence: number
  timestamp: string
  content: any
}

interface HistoryViewProps {
  onBack: () => void
}

const formatMarkdown = (text: string): string => {
  return text
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mb-2 mt-4">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mb-3 mt-5">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-4 mt-6">$1</h1>')
    .replace(/^\*\*(.*?)\*\*/gm, '<strong class="font-semibold">$1</strong>')
    .replace(/^\* (.*$)/gm, '<li class="ml-4">$1</li>')
    .replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4">$1. $2</li>')
    .replace(/---/g, '<hr class="border-gray-600 my-4">')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
}

const HistoryView: React.FC<HistoryViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'messages' | 'summary'>('messages')
  const [messages, setMessages] = useState<Message[]>([])
  const [summary, setSummary] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    fetchMessages()
  }, [])

  const fetchMessages = async () => {
    try {
      setLoading(true)
      setError('')

      const response: any = await browser.runtime.sendMessage({
        action: 'GET_TOPIC_MESSAGES',
        data: { topicId: '0.0.6534435' }
      })

      if (response.success && response.messages) {
        console.log('Raw messages from backend:', response.messages);

        const parsedMessages = response.messages.map((msg: any) => {
          console.log('Processing message:', msg);
          console.log('Message field type:', typeof msg.message);
          console.log('Message field value:', msg.message);

          let messageContent;
          try {
            // Try to parse the message content
            if (msg.message && typeof msg.message === 'string' && msg.message.trim().length > 0) {
              if (msg.message.startsWith('{') || msg.message.startsWith('[')) {
                messageContent = JSON.parse(msg.message);
              } else {
                // Plain text message
                messageContent = { type: 'text', text: msg.message };
              }
            } else if (msg.message && typeof msg.message === 'object') {
              messageContent = msg.message;
            } else {
              // Fallback to raw data display
              console.warn('No message content found, displaying raw data');
              messageContent = {
                type: 'raw',
                text: `Raw message data - Sequence: ${msg.sequence_number}`,
                rawData: msg
              };
            }
          } catch (error: any) {
            console.error('Failed to parse message:', error, 'Raw msg:', msg);
            // Create a fallback content showing that there's an issue
            messageContent = {
              type: 'error',
              text: 'Failed to parse message content',
              error: error.message,
              rawData: msg.message || 'No message field'
            };
          }

          const result = {
            sequence: msg.sequence_number || 0,
            timestamp: msg.consensus_timestamp ?
              new Date(parseFloat(msg.consensus_timestamp) * 1000).toISOString() :
              new Date().toISOString(),
            content: messageContent,
            rawMessage: msg
          };

          console.log('Processed message result:', result);
          return result;
        });

        setMessages(parsedMessages)
      } else {
        setError(response.error || 'Failed to fetch messages')
      }
    } catch (err) {
      setError('Error fetching messages')
      console.error('Failed to fetch messages:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateSummary = async () => {
    try {
      setLoading(true)
      setError('')

      const response: any = await browser.runtime.sendMessage({
        action: 'GENERATE_SUMMARY',
        data: { messages: messages.map(m => m.content) }
      })

      if (response.success) {
        setSummary(response.summary)
      } else {
        setError(response.error || 'Failed to generate summary')
      }
    } catch (err) {
      setError('Error generating summary')
      console.error('Failed to generate summary:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Unknown time'
    }
  }

  const openHashScan = () => {
    window.open('https://hashscan.io/testnet/topic/0.0.6534435/messages', '_blank')
  }

  return (
    <div className="w-full h-full flex flex-col"
      style={{
        background: '#1a1a1a',
        backgroundImage: `
          linear-gradient(rgba(243, 186, 80, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(243, 186, 80, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px'
      }}>
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(243, 186, 80, 0.1)' }}>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-semibold text-white">Meeting History</h2>
        <button
          onClick={openHashScan}
          className="flex items-center gap-1 transition-colors text-sm hover:underline"
          style={{ color: '#F3BA50' }}
        >
          <ExternalLink className="w-4 h-4" />
          HashScan
        </button>
      </div>

      <div className="flex border-b" style={{ borderColor: 'rgba(243, 186, 80, 0.1)' }}>
        <button
          onClick={() => setActiveTab('messages')}
          className={`flex-1 py-3 px-4 font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'messages'
            ? 'text-yellow-400 border-b-2 border-yellow-400 bg-gray-800'
            : 'text-gray-400 hover:text-gray-200'
            }`}
        >
          <MessageSquare className="w-4 h-4" />
          Messages
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 py-3 px-4 font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'summary'
            ? 'text-yellow-400 border-b-2 border-yellow-400 bg-gray-800'
            : 'text-gray-400 hover:text-gray-200'
            }`}
        >
          <Zap className="w-4 h-4" />
          Summary
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'messages' && (
          <div className="h-full flex flex-col">
            <div className="p-3 border-b border-gray-700 bg-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">
                  Topic: 0.0.6534435 • {messages.length} messages
                </span>
                <button
                  onClick={fetchMessages}
                  disabled={loading}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:text-gray-500 text-sm"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading && messages.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading messages...
                </div>
              )}

              {error && (
                <div className="text-center text-red-400 py-8">
                  <p>{error}</p>
                  <button
                    onClick={fetchMessages}
                    className="mt-2 text-blue-400 hover:text-blue-300"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className="rounded-lg p-4 border transition-colors"
                  style={{
                    backgroundColor: '#1a1a1a',
                    borderColor: 'rgba(243, 186, 80, 0.2)',
                    backgroundImage: `
                      linear-gradient(rgba(243, 186, 80, 0.02) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(243, 186, 80, 0.02) 1px, transparent 1px)
                    `,
                    backgroundSize: '10px 10px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(243, 186, 80, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(243, 186, 80, 0.2)';
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(243, 186, 80, 0.8)' }}>
                      <Clock className="w-3 h-3" />
                      {formatTime(message.timestamp)}
                    </div>
                    <span
                      className="text-xs px-2 py-1 rounded font-mono"
                      style={{
                        backgroundColor: 'rgba(243, 186, 80, 0.15)',
                        color: '#F3BA50'
                      }}
                    >
                      #{message.sequence}
                    </span>
                  </div>

                  {message.content.type === 'transcription' && message.content.segment && (
                    <div className="space-y-3">
                      <div className="text-sm leading-relaxed text-white">
                        "{message.content.segment.text.length > 120 ?
                          message.content.segment.text.substring(0, 120) + '...' :
                          message.content.segment.text}"
                      </div>
                      <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        <span>Meeting: {message.content.meetingId}</span>
                        <span>Confidence: {Math.round((message.content.segment.confidence || 0) * 100)}%</span>
                      </div>
                    </div>
                  )}

                  {message.content.type === 'text' && (
                    <div className="text-sm leading-relaxed text-white">
                      {message.content.text}
                    </div>
                  )}

                  {message.content.type === 'raw' && (
                    <div className="space-y-2">
                      <div className="text-sm text-yellow-300">
                        {message.content.text}
                      </div>
                      <details className="text-xs">
                        <summary className="text-gray-400 cursor-pointer hover:text-gray-300">
                          View Raw Data
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-900 rounded text-xs overflow-x-auto">
                          {JSON.stringify(message.content.rawData, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}

                  {message.content.type === 'error' && (
                    <div className="space-y-2">
                      <div className="text-sm text-red-300">
                        {message.content.text}
                      </div>
                      <div className="text-xs text-red-400">
                        Error: {message.content.error}
                      </div>
                      <details className="text-xs">
                        <summary className="text-gray-400 cursor-pointer hover:text-gray-300">
                          View Raw Data
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-900 rounded text-xs overflow-x-auto">
                          {JSON.stringify(message.content.rawData, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}

                  {!['transcription', 'text', 'raw', 'error'].includes(message.content.type) && (
                    <div className="text-sm text-white opacity-75">
                      {JSON.stringify(message.content).substring(0, 100)}...
                    </div>
                  )}
                </div>
              ))}

              {!loading && messages.length === 0 && !error && (
                <div className="text-center text-gray-400 py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No messages found</p>
                  <p className="text-sm mt-1">Start recording to see messages here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-700 bg-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white">Meeting Summary</h3>
                <button
                  onClick={generateSummary}
                  disabled={loading || messages.length === 0}
                  className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:text-gray-400 text-black px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                  <Zap className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
                  {loading ? 'Generating...' : 'Generate Summary'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading && !summary && (
                <div className="text-center text-gray-400 py-8">
                  <Zap className="w-6 h-6 animate-pulse mx-auto mb-2" />
                  Generating summary...
                </div>
              )}

              {error && (
                <div className="text-center text-red-400 py-8">
                  <p>{error}</p>
                </div>
              )}

              {summary && (
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div
                      className="text-gray-200 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatMarkdown(summary) }}
                    />
                  </div>
                </div>
              )}

              {!loading && !summary && !error && (
                <div className="text-center text-gray-400 py-8">
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No summary generated yet</p>
                  <p className="text-sm mt-1">Click "Generate Summary" to analyze meeting messages</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryView