import { useState } from 'react'
import { ChevronDown, ArrowUpDown } from 'lucide-react'
import { TokenSelector } from './TokenSelector'

interface SwapWidgetBaseProps {
  sellToken: string
  buyToken: string
  sellAmount: string
  buyAmount: string
  onSellTokenChange: (token: string) => void
  onBuyTokenChange: (token: string) => void
  onSellAmountChange: (amount: string) => void
  onBuyAmountChange: (amount: string) => void
  onSwap: () => void
  buttonText: string
  isButtonDisabled: boolean
  isLoading: boolean
  error?: string
}

export default function SwapWidgetBase({
  sellToken,
  buyToken,
  sellAmount,
  buyAmount,
  onSellTokenChange,
  onBuyTokenChange,
  onSellAmountChange,
  onBuyAmountChange,
  onSwap,
  buttonText,
  isButtonDisabled,
  isLoading,
  error
}: SwapWidgetBaseProps) {
  const [activeTab, setActiveTab] = useState<'swap' | 'limit'>('swap')
  const [showSellTokenSelector, setShowSellTokenSelector] = useState(false)
  const [showBuyTokenSelector, setShowBuyTokenSelector] = useState(false)
  const [marketType, setMarketType] = useState<'market' | 'percentage'>('market')
  const [expiry, setExpiry] = useState('1 day')

  const handleSwapDirection = () => {
    const tempToken = sellToken
    const tempAmount = sellAmount
    onSellTokenChange(buyToken)
    onBuyTokenChange(tempToken)
    onSellAmountChange(buyAmount)
    onBuyAmountChange(tempAmount)
  }

  return (
    <div className="bg-black/40 backdrop-blur-sm border border-crownie-orange/20 rounded-2xl p-6">
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab('swap')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'swap'
              ? 'bg-crownie-orange text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Swap
        </button>
        <button
          onClick={() => setActiveTab('limit')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'limit'
              ? 'bg-crownie-orange text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Limit
        </button>
      </div>

      {activeTab === 'limit' && (
        <div className="mb-6 space-y-4">
          <div className="text-sm text-gray-300">
            Swap when 1 {sellToken} is worth 691.215
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setMarketType('market')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                marketType === 'market'
                  ? 'bg-crownie-orange text-black'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              Market
            </button>
            <button
              onClick={() => setMarketType('percentage')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                marketType === 'percentage'
                  ? 'bg-crownie-orange text-black'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              +1%
            </button>
            <button
              onClick={() => setMarketType('percentage')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                marketType === 'percentage'
                  ? 'bg-crownie-orange text-black'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              +5%
            </button>
            <button
              onClick={() => setMarketType('percentage')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                marketType === 'percentage'
                  ? 'bg-crownie-orange text-black'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              +10%
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">Expiry</span>
            <div className="flex gap-2">
              <button
                onClick={() => setExpiry('1 day')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  expiry === '1 day'
                    ? 'bg-crownie-orange text-black'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                1 day
              </button>
              <button
                onClick={() => setExpiry('1 week')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  expiry === '1 week'
                    ? 'bg-crownie-orange text-black'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                1 week
              </button>
              <button
                onClick={() => setExpiry('1 month')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  expiry === '1 month'
                    ? 'bg-crownie-orange text-black'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                1 month
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-gray-900/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">Sell</label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={sellAmount}
              onChange={(e) => onSellAmountChange(e.target.value)}
              placeholder="0"
              className="flex-1 bg-transparent text-white text-xl font-medium outline-none"
            />
            <button
              onClick={() => setShowSellTokenSelector(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <div className="w-6 h-6 bg-crownie-orange rounded-full flex items-center justify-center">
                <span className="text-black font-bold text-xs">{sellToken[0]}</span>
              </div>
              <span className="text-white font-medium">{sellToken}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleSwapDirection}
            className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowUpDown className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">Buy</label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={buyAmount}
              onChange={(e) => onBuyAmountChange(e.target.value)}
              placeholder="0"
              className="flex-1 bg-transparent text-white text-xl font-medium outline-none"
            />
            <button
              onClick={() => setShowBuyTokenSelector(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <div className="w-6 h-6 bg-crownie-orange rounded-full flex items-center justify-center">
                <span className="text-black font-bold text-xs">{buyToken[0]}</span>
              </div>
              <span className="text-white font-medium">{buyToken}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <button
          onClick={onSwap}
          disabled={isButtonDisabled}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
            isButtonDisabled
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-crownie-orange text-black hover:bg-crownie-orange/90'
          }`}
        >
          {isLoading ? 'Processing...' : buttonText}
        </button>
      </div>

      {showSellTokenSelector && (
        <TokenSelector
          selectedToken={sellToken}
          onSelect={(token) => {
            onSellTokenChange(token)
            setShowSellTokenSelector(false)
          }}
          onClose={() => setShowSellTokenSelector(false)}
        />
      )}

      {showBuyTokenSelector && (
        <TokenSelector
          selectedToken={buyToken}
          onSelect={(token) => {
            onBuyTokenChange(token)
            setShowBuyTokenSelector(false)
          }}
          onClose={() => setShowBuyTokenSelector(false)}
        />
      )}
    </div>
  )
} 