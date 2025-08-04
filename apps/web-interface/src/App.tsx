
const WaveformBackground = () => {
  const waves = Array.from({ length: 80 }, (_, i) => {
    const height = Math.random() * 100 + 20
    const delay = Math.random() * 2
    return (
      <div
        key={i}
        className="bg-white/20 rounded-sm animate-pulse"
        style={{
          width: '4px',
          height: `${height}%`,
          animationDelay: `${delay}s`,
          animationDuration: '3s'
        }}
      />
    )
  })

  return (
    <div className="absolute bottom-0 left-0 right-0 h-32 flex items-end justify-center gap-1 opacity-30">
      {waves}
    </div>
  )
}

const Header = () => (
  <header className="flex justify-between items-center p-6 relative z-10">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-gradient-to-r from-crownie-primary to-crownie-secondary rounded"></div>
      <span className="text-white font-semibold text-xl">Crownie</span>
    </div>
    <button className="px-4 py-2 border border-gray-600 text-white rounded-lg hover:bg-gray-800 transition-colors">
      Join Meeting
    </button>
  </header>
)

const HeroSection = () => (
  <section className="relative min-h-screen bg-gray-900 overflow-hidden">
    <Header />
    <WaveformBackground />
    
    <div className="flex flex-col items-center justify-center text-center px-6 py-20 relative z-10">
      <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 max-w-4xl">
        <span className="text-crownie-primary">Speak.</span>{' '}
        <span className="text-crownie-secondary">Track.</span>{' '}
        <span className="text-white">Execute.</span>
      </h1>
      
      <p className="text-gray-300 text-lg md:text-xl mb-8 max-w-2xl">
        Turn live team calls into instant, executable actions — so your DAO 
        never waits on "follow-ups" again.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <button className="px-8 py-3 bg-crownie-primary text-black font-semibold rounded-lg hover:bg-crownie-secondary transition-colors">
          Try Crownie
        </button>
        <button className="px-8 py-3 border border-gray-600 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2">
          Watch Demo <span className="text-crownie-primary">▶</span>
        </button>
      </div>
    </div>
  </section>
)

const ProblemSection = () => (
  <section className="bg-gray-900 py-20 px-6">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-crownie-primary text-sm font-semibold mb-4">THE PROBLEM</h2>
        <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Where DAOs Slow Down
        </h3>
        <p className="text-xl text-white mb-8">
          Coordination is broken in <span className="text-crownie-primary">Web3 teams.</span>
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-6xl font-bold text-crownie-primary mb-4">01</div>
          <h4 className="text-xl font-semibold text-white mb-3">Multisig + Teamwork</h4>
          <p className="text-gray-300">
            Even small teams wait. Approvals drag. 
            Steps are delayed.
          </p>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-6xl font-bold text-crownie-primary mb-4">02</div>
          <h4 className="text-xl font-semibold text-white mb-3">Real consensus happens in calls — not proposals</h4>
          <p className="text-gray-300">
            Key decisions are verbal but never make it on-chain.
          </p>
          <div className="mt-4 bg-blue-600 rounded p-3">
            <div className="flex items-center gap-2 text-white text-sm">
              <div className="w-4 h-4 bg-green-400 rounded"></div>
              <div className="w-4 h-4 bg-blue-400 rounded"></div>
              <div className="w-4 h-4 bg-purple-400 rounded"></div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-6xl font-bold text-crownie-primary mb-4">03</div>
          <h4 className="text-xl font-semibold text-white mb-3">Hours pass. Tokens move. Prices shift.</h4>
          <p className="text-gray-300">
            Still waiting for signers to approve what they already agreed.
          </p>
          <div className="mt-4 bg-teal-700 rounded p-3 h-16"></div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-6xl font-bold text-crownie-primary mb-4">04</div>
          <h4 className="text-xl font-semibold text-white mb-3">What happens next?</h4>
          <p className="text-gray-300">
            Another follow-up meeting. Another round of coordination fatigue.
          </p>
        </div>
      </div>
    </div>
  </section>
)

const SolutionSection = () => (
  <section className="bg-gray-900 py-20 px-6">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-crownie-primary text-sm font-semibold mb-4">THE SOLUTION</h2>
        <h3 className="text-3xl md:text-4xl font-bold text-white mb-8">
          Meet Crownie
        </h3>
        <p className="text-xl text-white">
          From Spoken Decisions to <span className="text-crownie-primary">On-Chain Execution.</span>
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
          <div className="w-16 h-16 bg-crownie-primary rounded-lg mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">📞</span>
          </div>
          <h4 className="text-lg font-semibold text-white mb-3">Live Call Listening</h4>
          <p className="text-gray-300 text-sm">
            Crownie captures intent directly from your team calls.
          </p>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
          <div className="w-16 h-16 bg-crownie-primary rounded-lg mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">✨</span>
          </div>
          <h4 className="text-lg font-semibold text-white mb-3">AI Summarization</h4>
          <p className="text-gray-300 text-sm">
            Agreements are summarized in plain language & structured actions.
          </p>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
          <div className="w-16 h-16 bg-crownie-primary rounded-lg mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">✓</span>
          </div>
          <h4 className="text-lg font-semibold text-white mb-3">Instant Execution</h4>
          <p className="text-gray-300 text-sm">
            Generates executable intents compatible with Fusion cross-chain approvals.
          </p>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
          <div className="w-16 h-16 bg-crownie-primary rounded-lg mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">⏱</span>
          </div>
          <h4 className="text-lg font-semibold text-white mb-3">No Follow-Ups</h4>
          <p className="text-gray-300 text-sm">
            Signers can push actions to real-time — with the voting.
          </p>
        </div>
      </div>
    </div>
  </section>
)

function App() {
  return (
    <div className="min-h-screen bg-gray-900">
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
    </div>
  )
}

export default App
