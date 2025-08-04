



const ProblemSection = () => (
    <section className="bg-crownie-dark py-20 px-6">
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

export default ProblemSection