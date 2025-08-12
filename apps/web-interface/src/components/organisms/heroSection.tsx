import { motion } from 'framer-motion'
import Header from "./header";
import {
    staggerContainerVariants,
    heroTextVariants,
    buttonVariants,
    textRevealVariants
} from '../../utils/animations'

const HeroSection = () => {
    return (
        <section
            className="relative h-screen overflow-hidden"
            style={{
                background: 'linear-gradient(180deg, #191919 0%, #2A2A2A 50%, #3A3A3A 100%)',
            }}
        >
            <div
                className="absolute inset-0 w-full h-full"
                style={{
                    backgroundImage: 'url(/hero.svg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'bottom center',
                    backgroundRepeat: 'no-repeat',
                    backgroundAttachment: 'fixed',
                    opacity: 0.8
                }}
            />
            <Header />

            <motion.div 
                className="flex flex-col items-center justify-center text-center py-20 relative z-10"
                variants={staggerContainerVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.h1 
                    className="text-4xl md:text-6xl font-bold text-white mb-6 max-w-4xl"
                    variants={heroTextVariants}
                >
                    <motion.span 
                        className="text-crownie-primary"
                        variants={textRevealVariants}
                    >
                        Speak.
                    </motion.span>{' '}
                    <motion.span 
                        className="text-crownie-secondary"
                        variants={textRevealVariants}
                    >
                        Track.
                    </motion.span>{' '}
                    <motion.span 
                        className="text-white"
                        variants={textRevealVariants}
                    >
                        Execute.
                    </motion.span>
                </motion.h1>

                <motion.p 
                    className="text-gray-300 text-lg md:text-xl mb-8 max-w-2xl"
                    variants={textRevealVariants}
                >
                    Turn live team calls into instant, executable actions — so your DAO
                    never waits on "follow-ups" again.
                </motion.p>

                <motion.div 
                    className="w-full backdrop-blur-md bg-black bg-opacity-5 border-t border-b border-white border-opacity-20 py-8"
                    variants={buttonVariants}
                >
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <motion.a 
                            href="https://github.com/acgodson/crownie-hedera/releases/download/v0.0.17/crownie-extension-v0.0.17.zip"
                            download="crownie-extension-v0.0.17.zip"
                            className="px-8 py-3 bg-crownie-primary text-black font-semibold rounded-lg transition-colors inline-block"
                            variants={buttonVariants}
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
                            variants={buttonVariants}
                            whileHover="hover"
                            whileTap="tap"
                        >
                            Watch Demo <span className="text-crownie-primary">▶</span>
                        </motion.a>
                    </div>
                </motion.div>
            </motion.div>
        </section>
    );
};

export default HeroSection;