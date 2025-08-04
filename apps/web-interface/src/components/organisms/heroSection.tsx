import Header from "./header";



const HeroSection = () => (
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
                opacity: 0.8
            }}
        />
        <Header />

        <div className="flex flex-col items-center justify-center text-center py-20 relative z-10">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 max-w-4xl">
                <span className="text-crownie-primary">Speak.</span>{' '}
                <span className="text-crownie-secondary">Track.</span>{' '}
                <span className="text-white">Execute.</span>
            </h1>

            <p className="text-gray-300 text-lg md:text-xl mb-8 max-w-2xl">
                Turn live team calls into instant, executable actions — so your DAO
                never waits on "follow-ups" again.
            </p>

            <div className="w-full backdrop-blur-md bg-black bg-opacity-5 border-t border-b border-white border-opacity-20 py-8">
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <button className="px-8 py-3 bg-crownie-primary text-black font-semibold rounded-lg hover:bg-crownie-secondary transition-colors">
                        Try Crownie
                    </button>
                    <button className="px-8 py-3 border border-crownie-primary text-white rounded-lg hover:bg-crownie-primary hover:bg-opacity-10 transition-colors flex items-center gap-2">
                        Watch Demo <span className="text-crownie-primary">▶</span>
                    </button>
                </div>
            </div>
        </div>
    </section>
)

export default HeroSection;