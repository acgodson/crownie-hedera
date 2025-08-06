
const SolutionSection = () => (
    <section className="relative min-h-screen bg-crownie-dark py-20 px-6 overflow-hidden">

        <div
            className="absolute inset-0 opacity-10"
            style={{
                backgroundImage: `
            linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
          `,
                backgroundSize: '50px 50px'
            }}
        />

        <div className="max-w-6xl mx-auto relative z-10">
            <div className="text-center mb-16">
                <div className="w-8 h-1 bg-crownie-primary mx-auto mb-4"></div>
                <h2 className="text-crownie-primary text-sm font-semibold mb-4 tracking-wide">THE SOLUTION</h2>
                <h3 className="text-white text-lg mb-4">Meet Crownie</h3>
                <h4 className="text-3xl md:text-5xl font-bold text-white mb-8">
                    From Spoken Decisions to <span className="text-crownie-primary">On-Chain Execution.</span>
                </h4>
                <div className="w-8 h-1 bg-crownie-primary mx-auto"></div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-32">

                <div className="backdrop-blur-md bg-black bg-opacity-5 rounded-2xl p-8 border border-white border-opacity-20 text-center">
                    <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-crownie-primary to-crownie-secondary">
                        <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                        </svg>
                    </div>
                    <h4 className="text-xl font-semibold text-white mb-3">Live Call Listening</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        Crownie captures intent directly from your team calls.
                    </p>
                </div>


                <div className="backdrop-blur-md bg-black bg-opacity-5 rounded-2xl p-8 border border-white border-opacity-20 text-center">
                    <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-crownie-primary to-crownie-secondary">
                        <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                    </div>
                    <h4 className="text-xl font-semibold text-white mb-3">AI Summarization</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        Agreements are summarized in plain language & structured actions.
                    </p>
                </div>


                <div className="backdrop-blur-md bg-black bg-opacity-5 rounded-2xl p-8 border border-white border-opacity-20 text-center">
                    <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-crownie-primary to-crownie-secondary">
                        <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                    </div>
                    <h4 className="text-xl font-semibold text-white mb-3">Instant Execution</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        Generates executable intents compatible with Fusion cross-chain approvals.
                    </p>
                </div>

                {/* No Follow-Ups - Centered below */}
                <div className="backdrop-blur-md bg-black bg-opacity-5  rounded-2xl p-8 border border-white border-opacity-20 text-center md:col-start-2 lg:col-start-2">
                    <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-crownie-primary to-crownie-secondary">
                        <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
                            <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                        </svg>
                    </div>
                    <h4 className="text-xl font-semibold text-white mb-3">No Follow-Ups</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        Signers can push actions in real-time—skip the waiting.
                    </p>
                </div>
            </div>


            <div className="text-center mb-32 mt-20">
                <h2 className="text-crownie-primary text-sm font-semibold mb-8 tracking-wide">SOLUTION DESIGN</h2>
                <h3 className="text-white text-lg mb-4">Voice-Native DAO Ops</h3>
                <h4 className="text-3xl md:text-5xl font-bold text-white mb-16">
                    Designed for fast, <span className="text-crownie-primary">trustless coordination.</span>
                </h4>


                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">

                    <div className="backdrop-blur-md bg-white bg-opacity-5 rounded-2xl p-8 border border-white border-opacity-20 text-left">
                        <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 mb-6 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-700 opacity-50"></div>
                            <div className="relative z-10 flex items-center justify-center">
                                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                                </svg>
                            </div>
                        </div>
                        <h4 className="text-xl font-semibold text-white mb-4">Voice-Native Capture</h4>
                        <ul className="text-gray-300 text-sm leading-relaxed space-y-2">
                            <li>• Browser extension for Google Meet / Zoom.</li>
                            <li>• No workflow change—just talk, Crownie listens.</li>
                        </ul>
                    </div>


                    <div className="backdrop-blur-md bg-white bg-opacity-5 rounded-2xl p-8 border border-white border-opacity-20 text-left">
                        <div className="bg-gray-800 rounded-2xl p-6 mb-6 relative">
                            <div className="text-center">
                                <div className="mb-4">
                                    <h5 className="text-crownie-primary text-sm font-semibold">Crownie Solution</h5>
                                </div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                            <span className="text-white text-xs">👤</span>
                                        </div>
                                        <span className="text-white text-sm">Voice-Native</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                            <span className="text-white text-xs">🤖</span>
                                        </div>
                                        <span className="text-white text-sm">AI Agent Summarizer</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="w-8 h-8 bg-blue-600 rounded-full"></div>
                                    <div className="w-8 h-8 bg-green-600 rounded-full"></div>
                                    <div className="w-8 h-8 bg-purple-600 rounded-full"></div>
                                </div>
                            </div>
                        </div>
                        <h4 className="text-xl font-semibold text-white mb-4">AI Agent Summarizer & Intent Extractor</h4>
                        <ul className="text-gray-300 text-sm leading-relaxed space-y-2">
                            <li>• Distills spoken agreements into on-chain intents & tasks.</li>
                            <li>• Prevents "lost decisions" between calls.</li>
                        </ul>
                    </div>


                    <div className="backdrop-blur-md bg-white bg-opacity-5 rounded-2xl p-8 border border-white border-opacity-20 text-left">
                        <div className="bg-gradient-to-br from-orange-600 to-red-600 rounded-2xl p-6 mb-6 relative overflow-hidden">
                            <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                            <div className="relative z-10">
                                <div className="w-full h-32 bg-cover bg-center rounded-lg" style={{ backgroundImage: 'linear-gradient(45deg, #f59e0b 0%, #dc2626 100%)' }}></div>
                            </div>
                        </div>
                        <h4 className="text-xl font-semibold text-white mb-4">Intent Anchoring</h4>
                        <ul className="text-gray-300 text-sm leading-relaxed space-y-2">
                            <li>• Every spoken commitment is anchored & actionable, ready for multisig execution.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="text-center mb-16 mt-20">
                <h2 className="text-crownie-primary text-sm font-semibold mb-4 tracking-wide">GET STARTED</h2>
                <h3 className="text-white text-lg mb-4">Crownie has you covered</h3>
                <h4 className="text-3xl md:text-5xl font-bold text-white mb-12">
                    Turn conversations into <span className="text-crownie-primary">on-chain action.</span>
                </h4>


                <div className="max-w-2xl mx-auto p-8 border-2 border-crownie-primary rounded-2xl bg-gray-900 bg-opacity-30 backdrop-blur-sm relative">

                    <div
                        className="absolute inset-4 opacity-20"
                        style={{
                            backgroundImage: `
                  radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)
                `,
                            backgroundSize: '20px 20px'
                        }}
                    />

                    <div className="relative z-10">

                        <div className="flex justify-center items-center gap-8 mb-8">
                            <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-2xl">📊</span>
                            </div>
                            <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-2xl text-white">📹</span>
                            </div>
                            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-2xl text-white">🎯</span>
                            </div>
                            <div className="w-16 h-16 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-2xl text-white">💬</span>
                            </div>
                        </div>


                        <div className="mb-8">
                            <div className="w-20 h-20 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-lg">
                                <img src="/logo.png" alt="Crownie" className="w-12 h-12" />
                            </div>
                        </div>


                        <div className="flex justify-center items-center gap-8">
                            <div className="w-16 h-16 bg-green-500 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-2xl text-white">📁</span>
                            </div>
                            <div className="w-16 h-16 bg-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-2xl text-white">👥</span>
                            </div>
                            <div className="w-16 h-16 bg-blue-400 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-2xl text-white">💼</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12">
                    <a 
                        href="https://github.com/acgodson/crownie-etherlink/releases/tag/v0.0.14" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-8 py-3 bg-crownie-primary text-black font-semibold rounded-lg hover:bg-crownie-secondary transition-colors inline-block"
                    >
                        Try Crownie
                    </a>
                    <button className="px-8 py-3 border border-crownie-primary text-white rounded-lg hover:bg-crownie-primary hover:bg-opacity-10 transition-colors flex items-center gap-2">
                        Watch Demo <span className="text-crownie-primary">▶</span>
                    </button>
                </div>
            </div>
        </div>
    </section>
)

export default SolutionSection