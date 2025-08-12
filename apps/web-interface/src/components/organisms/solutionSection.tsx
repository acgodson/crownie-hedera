import { motion } from 'framer-motion'
import { useScrollAnimation } from '../../hooks/useScrollAnimation'
import {
    fadeUpVariants,
    staggerContainerVariants,
    slideUpVariants,
    scaleInVariants,
    cardHoverVariants,
    iconRotateVariants,
    lineDrawVariants,
    textRevealVariants
} from '../../utils/animations'

const SolutionSection = () => {
    const { ref: headerRef, isInView: headerInView } = useScrollAnimation()
    const { ref: cardsRef, isInView: cardsInView } = useScrollAnimation()
    const { ref: designRef, isInView: designInView } = useScrollAnimation()
    const { ref: designCardsRef, isInView: designCardsInView } = useScrollAnimation()
    const { ref: getStartedRef, isInView: getStartedInView } = useScrollAnimation()

    return (
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
            <motion.div 
                ref={headerRef}
                className="text-center mb-16"
                variants={staggerContainerVariants}
                initial="hidden"
                animate={headerInView ? "visible" : "hidden"}
            >
                <motion.div 
                    className="w-8 h-1 bg-crownie-primary mx-auto mb-4"
                    variants={lineDrawVariants}
                />
                <motion.h2 
                    className="text-crownie-primary text-sm font-semibold mb-4 tracking-wide"
                    variants={textRevealVariants}
                >
                    THE SOLUTION
                </motion.h2>
                <motion.h3 
                    className="text-white text-lg mb-4"
                    variants={textRevealVariants}
                >
                    Meet Crownie
                </motion.h3>
                <motion.h4 
                    className="text-3xl md:text-5xl font-bold text-white mb-8"
                    variants={fadeUpVariants}
                >
                    From Spoken Decisions to <span className="text-crownie-primary">On-Chain Execution.</span>
                </motion.h4>
                <motion.div 
                    className="w-8 h-1 bg-crownie-primary mx-auto"
                    variants={lineDrawVariants}
                />
            </motion.div>


            <motion.div 
                ref={cardsRef}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-32"
                variants={staggerContainerVariants}
                initial="hidden"
                animate={cardsInView ? "visible" : "hidden"}
            >

                <motion.div 
                    className="backdrop-blur-md bg-black bg-opacity-5 rounded-2xl p-8 border border-white border-opacity-20 text-center"
                    variants={slideUpVariants}
                    whileHover="hover"
                    initial="rest"
                >
                    <motion.div 
                        className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-crownie-primary to-crownie-secondary"
                        variants={iconRotateVariants}
                    >
                        <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                        </svg>
                    </motion.div>
                    <h4 className="text-xl font-semibold text-white mb-3">Live Call Listening</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        Crownie captures intent directly from your team calls.
                    </p>
                </motion.div>


                <motion.div 
                    className="backdrop-blur-md bg-black bg-opacity-5 rounded-2xl p-8 border border-white border-opacity-20 text-center"
                    variants={slideUpVariants}
                    whileHover="hover"
                    initial="rest"
                >
                    <motion.div 
                        className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-crownie-primary to-crownie-secondary"
                        variants={iconRotateVariants}
                    >
                        <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                    </motion.div>
                    <h4 className="text-xl font-semibold text-white mb-3">AI Summarization</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        Agreements are summarized in plain language & structured actions.
                    </p>
                </motion.div>


                <motion.div 
                    className="backdrop-blur-md bg-black bg-opacity-5 rounded-2xl p-8 border border-white border-opacity-20 text-center"
                    variants={slideUpVariants}
                    whileHover="hover"
                    initial="rest"
                >
                    <motion.div 
                        className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-crownie-primary to-crownie-secondary"
                        variants={iconRotateVariants}
                    >
                        <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                    </motion.div>
                    <h4 className="text-xl font-semibold text-white mb-3">Instant Execution</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        Generates executable intents compatible with Fusion cross-chain approvals.
                    </p>
                </motion.div>

                <motion.div 
                    className="backdrop-blur-md bg-black bg-opacity-5  rounded-2xl p-8 border border-white border-opacity-20 text-center md:col-start-2 lg:col-start-2"
                    variants={slideUpVariants}
                    whileHover="hover"
                    initial="rest"
                >
                    <motion.div 
                        className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-crownie-primary to-crownie-secondary"
                        variants={iconRotateVariants}
                    >
                        <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
                            <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                        </svg>
                    </motion.div>
                    <h4 className="text-xl font-semibold text-white mb-3">No Follow-Ups</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        Signers can push actions in real-time—skip the waiting.
                    </p>
                </motion.div>
            </motion.div>


            <motion.div 
                ref={designRef}
                className="text-center mb-32 mt-20"
                variants={staggerContainerVariants}
                initial="hidden"
                animate={designInView ? "visible" : "hidden"}
            >
                <motion.h2 
                    className="text-crownie-primary text-sm font-semibold mb-8 tracking-wide"
                    variants={textRevealVariants}
                >
                    SOLUTION DESIGN
                </motion.h2>
                <motion.h3 
                    className="text-white text-lg mb-4"
                    variants={textRevealVariants}
                >
                    Voice-Native DAO Ops
                </motion.h3>
                <motion.h4 
                    className="text-3xl md:text-5xl font-bold text-white mb-16"
                    variants={fadeUpVariants}
                >
                    Designed for fast, <span className="text-crownie-primary">trustless coordination.</span>
                </motion.h4>


                <motion.div 
                    ref={designCardsRef}
                    className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16"
                    variants={staggerContainerVariants}
                    initial="hidden"
                    animate={designCardsInView ? "visible" : "hidden"}
                >

                    <motion.div 
                        className="backdrop-blur-md bg-white bg-opacity-5 rounded-2xl p-8 border border-white border-opacity-20 text-left"
                        variants={slideUpVariants}
                        whileHover="hover"
                        initial="rest"
                    >
                        <motion.div 
                            className="rounded-2xl mb-6 relative overflow-hidden" 
                            style={{ height: '200px' }}
                            variants={scaleInVariants}
                        >
                            <img
                                src="/voice-native.png"
                                alt="Voice Native Integration"
                                className="w-full h-full object-cover rounded-xl"
                            />
                        </motion.div>
                        <h4 className="text-xl font-semibold text-white mb-4">Voice-Native Capture</h4>
                        <ul className="text-gray-300 text-sm leading-relaxed space-y-2">
                            <li>• Browser extension for Google Meet / Zoom.</li>
                            <li>• No workflow change—just talk, Crownie listens.</li>
                        </ul>
                    </motion.div>


                    <motion.div 
                        className="backdrop-blur-md bg-white bg-opacity-5 rounded-2xl p-8 border border-white border-opacity-20 text-left"
                        variants={slideUpVariants}
                        whileHover="hover"
                        initial="rest"
                    >
                        <motion.div 
                            className="rounded-2xl mb-6 relative overflow-hidden" 
                            style={{ height: '200px' }}
                            variants={scaleInVariants}
                        >
                            <img
                                src="/summarizer.png"
                                alt="AI Agent Summarizer"
                                className="w-full h-full object-cover rounded-xl"
                            />
                        </motion.div>
                        <h4 className="text-xl font-semibold text-white mb-4">AI Agent Summarizer & Intent Extractor</h4>
                        <ul className="text-gray-300 text-sm leading-relaxed space-y-2">
                            <li>• Distills spoken agreements into on-chain intents & tasks.</li>
                            <li>• Prevents "lost decisions" between calls.</li>
                        </ul>
                    </motion.div>


                    <motion.div 
                        className="backdrop-blur-md bg-white bg-opacity-5 rounded-2xl p-8 border border-white border-opacity-20 text-left"
                        variants={slideUpVariants}
                        whileHover="hover"
                        initial="rest"
                    >
                        <motion.div 
                            className="rounded-2xl mb-6 relative overflow-hidden" 
                            style={{ height: '200px' }}
                            variants={scaleInVariants}
                        >
                            <img
                                src="/laptop.png"
                                alt="Intent Anchoring"
                                className="w-full h-full object-cover rounded-xl"
                            />
                        </motion.div>
                        <h4 className="text-xl font-semibold text-white mb-4">Intent Anchoring</h4>
                        <ul className="text-gray-300 text-sm leading-relaxed space-y-2">
                            <li>• Every spoken commitment is anchored & actionable, ready for multisig execution.</li>
                        </ul>
                    </motion.div>
                </motion.div>
            </motion.div>

            <motion.div 
                ref={getStartedRef}
                className="text-center mb-16 mt-20"
                variants={staggerContainerVariants}
                initial="hidden"
                animate={getStartedInView ? "visible" : "hidden"}
            >
                <motion.h2 
                    className="text-crownie-primary text-sm font-semibold mb-4 tracking-wide"
                    variants={textRevealVariants}
                >
                    GET STARTED
                </motion.h2>
                <motion.h3 
                    className="text-white text-lg mb-4"
                    variants={textRevealVariants}
                >
                    Crownie has you covered
                </motion.h3>
                <motion.h4 
                    className="text-3xl md:text-5xl font-bold text-white mb-12"
                    variants={fadeUpVariants}
                >
                    Turn conversations into <span className="text-crownie-primary">on-chain action.</span>
                </motion.h4>

                <motion.div 
                    className="max-w-4xl mx-auto"
                    variants={scaleInVariants}
                >
                    <img 
                        src="/on-chain-actions.png" 
                        alt="On-Chain Actions Integration" 
                        className="w-full h-auto rounded-2xl"
                    />
                </motion.div>

                <motion.div 
                    className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12"
                    variants={staggerContainerVariants}
                >
                    <motion.a 
                        href="https://github.com/acgodson/crownie-hedera/releases/download/v0.0.17/crownie-extension-v0.0.17.zip"
                        download="crownie-extension-v0.0.17.zip"
                        className="px-8 py-3 bg-crownie-primary text-black font-semibold rounded-lg transition-colors inline-block"
                        variants={slideUpVariants}
                        whileHover="hover"
                        whileTap="tap"
                    >
                        Try Crownie
                    </motion.a>
                    <motion.a 
                        href="https://youtu.be/-PZCRc5xOQw"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-8 py-3 border border-crownie-primary text-white rounded-lg hover:bg-crownie-primary hover:bg-opacity-10 transition-colors flex items-center gap-2"
                        variants={slideUpVariants}
                        whileHover="hover"
                        whileTap="tap"
                    >
                        Watch Demo <span className="text-crownie-primary">▶</span>
                    </motion.a>
                </motion.div>
            </motion.div>
        </div>
    </section>
    )
}

export default SolutionSection