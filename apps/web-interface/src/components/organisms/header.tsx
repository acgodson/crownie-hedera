
const Header = () => (
    <header className="flex justify-between items-center p-6 relative z-10">
        <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Crownie" className="w-8 h-8" />
            <span className="text-white font-semibold text-xl">Crownie</span>
        </div>
        <button className="px-4 py-2 border border-gray-600 text-white rounded-lg hover:bg-gray-800 transition-colors">
            Join Meeting
        </button>
    </header>
)

export default Header