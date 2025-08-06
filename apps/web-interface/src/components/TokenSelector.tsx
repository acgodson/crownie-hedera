import { X } from 'lucide-react'

interface Token {
    symbol: string
    name: string
    address: string
    decimals: number
    logo?: string
}

interface TokenSelectorProps {
    selectedToken: string
    onSelect: (token: string) => void
    onClose: () => void
}

const AVAILABLE_TOKENS: Token[] = [
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0x1234567890123456789012345678901234567891',
    decimals: 6
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x1234567890123456789012345678901234567892',
    decimals: 6
  }
]

export function TokenSelector({ selectedToken, onSelect, onClose }: TokenSelectorProps) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-white font-semibold text-lg">Select Token</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {AVAILABLE_TOKENS.map((token) => (
                        <button
                            key={token.address}
                            onClick={() => onSelect(token.symbol)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${selectedToken === token.symbol
                                    ? 'bg-crownie-orange/20 border border-crownie-orange/40'
                                    : 'hover:bg-gray-800'
                                }`}
                        >
                            <div className="w-8 h-8 bg-crownie-orange rounded-full flex items-center justify-center">
                                <span className="text-black font-bold text-sm">{token.symbol[0]}</span>
                            </div>
                            <div className="flex-1 text-left">
                                <div className="text-white font-medium">{token.symbol}</div>
                                <div className="text-gray-400 text-sm">{token.name}</div>
                            </div>
                            {selectedToken === token.symbol && (
                                <div className="w-2 h-2 bg-crownie-orange rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
} 