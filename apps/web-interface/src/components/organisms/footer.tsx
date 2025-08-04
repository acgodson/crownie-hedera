


const Footer = () => (
    <footer className="relative py-20 px-6 overflow-hidden" style={{backgroundColor: '#171717'}}>
        <div
            className="absolute bottom-0 left-0 right-0 h-64 opacity-60"
            style={{
                backgroundImage: 'url(/hero.svg)',
                backgroundSize: 'cover',
                backgroundPosition: 'bottom center',
                backgroundRepeat: 'no-repeat',
                transform: 'translateY(50%)'
            }}
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-30"></div>

        <div className="max-w-6xl mx-auto relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                <div>
                    <h3 className="text-white font-semibold mb-4">Product</h3>
                    <ul className="space-y-3">
                        <li><a href="#" className="text-gray-300 hover:text-crownie-primary transition-colors">Features</a></li>
                        <li><a href="#" className="text-gray-300 hover:text-crownie-primary transition-colors">Solution</a></li>
                        <li><a href="#" className="text-gray-300 hover:text-crownie-primary transition-colors">Watch Demo</a></li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-white font-semibold mb-4">Social Media</h3>
                    <ul className="space-y-3">
                        <li><a href="#" className="text-gray-300 hover:text-crownie-primary transition-colors">Twitter</a></li>
                        <li><a href="#" className="text-gray-300 hover:text-crownie-primary transition-colors">LinkedIn</a></li>
                        <li><a href="#" className="text-gray-300 hover:text-crownie-primary transition-colors">GitHub</a></li>
                    </ul>
                </div>


                <div>
                    <h3 className="text-white font-semibold mb-4">Legal</h3>
                    <ul className="space-y-3">
                        <li><a href="#" className="text-gray-300 hover:text-crownie-primary transition-colors">Privacy Policy</a></li>
                        <li><a href="#" className="text-gray-300 hover:text-crownie-primary transition-colors">Terms of Service</a></li>
                    </ul>
                </div>


                <div className="md:text-right">
                    <div className="flex items-center gap-2 md:justify-end mb-4">
                        <img src="/logo.png" alt="Crownie" className="w-8 h-8" />
                        <span className="text-white font-semibold text-xl">Crownie</span>
                    </div>
                    <p className="text-gray-400 text-sm">© 2025 Crownie. All rights reserved.</p>
                </div>
            </div>
        </div>
    </footer>
)


export default Footer;