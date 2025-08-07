import { useSearchParams } from 'react-router-dom'
import { useAccount, useConnect, useDisconnect, usePublicClient } from 'wagmi'
import { useEffect, useState } from 'react'
import SwapWidgetBase from './SwapWidgetBase'
import { useSwapState } from '../hooks/useSwapState'
import { useExtensionBridge } from '../hooks/useExtensionBridge'
import Footer from './organisms/footer'

export default function SwapWidget() {
    const [searchParams] = useSearchParams()
    const { address, isConnected } = useAccount()
    const { connect, connectors } = useConnect()
    const { disconnect } = useDisconnect()
    const { sendOrderCreated } = useExtensionBridge()
    const publicClient = usePublicClient()
    const [userBalance, setUserBalance] = useState<string>('Loading...')

    const hashLock = searchParams.get('secretHash') || searchParams.get('hashLock')
    const meetingId = searchParams.get('meetingId')

    const {
        sellToken,
        buyToken,
        sellAmount,
        buyAmount,
        setSellToken,
        setBuyToken,
        setSellAmount,
        setBuyAmount,
        createOrder,
        isLoading,
        error
    } = useSwapState(hashLock, meetingId)


    useEffect(() => {
        const updateCreationFee = async () => {
            if (!publicClient) return

            try {
                console.log('Reading creation fee from contract...')
                const creationFee = await publicClient.readContract({
                    address: '0x689b5A63B715a3bA57a900B58c74dA60F98F1370' as `0x${string}`,
                    abi: [{
                        inputs: [],
                        name: 'CREATION_FEE',
                        outputs: [{ "name": "", "type": "uint256" }],
                        stateMutability: 'view',
                        type: 'function'
                    }],
                    functionName: 'CREATION_FEE'
                })
                console.log('Creation fee read successfully:', creationFee.toString())
                const feeElement = document.getElementById('creation-fee')
                if (feeElement) {
                    feeElement.textContent = `${creationFee.toString()} wei`
                }
            } catch (error) {
                console.error('Failed to get creation fee:', error)
                const feeElement = document.getElementById('creation-fee')
                if (feeElement) {
                    feeElement.textContent = 'Error loading'
                }
            }
        }
        updateCreationFee()
    }, [publicClient])

    useEffect(() => {
        const checkBalance = async () => {
            if (!publicClient || !address) {
                setUserBalance('Not connected')
                return
            }

            try {
                const balance = await publicClient.readContract({
                    address: '0xf7f007dc8Cb507e25e8b7dbDa600c07FdCF9A75B' as `0x${string}`, // USDT
                    abi: [{
                        inputs: [{ "name": "account", "type": "address" }],
                        name: 'balanceOf',
                        outputs: [{ "name": "", "type": "uint256" }],
                        stateMutability: 'view',
                        type: 'function'
                    }],
                    functionName: 'balanceOf',
                    args: [address]
                })
                setUserBalance(balance.toString())
            } catch (error) {
                console.error('Failed to get balance:', error)
                setUserBalance('Error loading')
            }
        }

        checkBalance()
    }, [publicClient, address])

    const handleConnect = () => {
        if (connectors[0]) {
            connect({ connector: connectors[0] })
        }
    }

    const handleDisconnect = () => {
        disconnect()
    }

    const handleSwap = async () => {
        if (!isConnected || !address) {
            handleConnect()
            return
        }

        try {
            const orderId = await createOrder()

            if (orderId && meetingId) {

                console.log('📤 Sending order created message to extension...', { orderId, meetingId })
                const confirmed = await sendOrderCreated({
                    orderId,
                    meetingId,
                    data: {
                        sellToken,
                        buyToken,
                        sellAmount,
                        buyAmount
                    }
                })

                if (confirmed) {
                    console.log('✅ Extension confirmed order creation, closing window...')
                    setTimeout(() => {
                        window.close()
                    }, 1000)
                } else {
                    console.log('❌ Extension did not confirm order creation within timeout')
                    alert('Order created but extension did not respond. You can manually close this tab.')
                }
            }
        } catch (err) {
            console.error('Failed to create order:', err)
        }
    }

    const getButtonText = () => {
        if (!isConnected) return 'Connect Wallet'
        if (!sellAmount || sellAmount === '0') return 'Enter Amount'
        if (isLoading) return 'Processing...'
        return 'Confirm Order'
    }

    const isButtonDisabled = () => {
        if (!isConnected) return false
        if (!sellAmount || sellAmount === '0') return true
        if (isLoading) return true
        return false
    }

    return (
        <div className="min-h-screen bg-crownie-dark relative overflow-hidden">
            <div
                className="absolute inset-0 opacity-5"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
                    backgroundSize: '20px 20px'
                }}
            />

            <div className="relative z-10 min-h-screen flex flex-col">
                <header className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="Crownie" className="w-8 h-8" />
                        <span className="text-white font-semibold text-lg">Crownie</span>
                    </div>

                    {isConnected ? (
                        <button
                            onClick={handleDisconnect}
                            className="flex items-center gap-2 px-4 py-2 bg-crownie-orange/10 border border-crownie-orange/20 rounded-lg text-crownie-orange hover:bg-crownie-orange/20 transition-colors"
                        >
                            <div className="w-4 h-4 bg-crownie-orange rounded-full" />
                            <span className="text-sm font-medium">
                                {address?.slice(0, 6)}...{address?.slice(-4)}
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={handleConnect}
                            className="px-4 py-2 bg-crownie-orange text-black font-medium rounded-lg hover:bg-crownie-orange/90 transition-colors"
                        >
                            Connect Wallet
                        </button>
                    )}
                </header>

                <main className="flex-1 flex items-center justify-center px-4">
                    <div className="w-full max-w-md">
                        <h1 className="text-3xl font-bold text-crownie-orange text-center mb-8">
                            Swap fast, Swap here.
                        </h1>

                        <SwapWidgetBase
                            sellToken={sellToken}
                            buyToken={buyToken}
                            sellAmount={sellAmount}
                            buyAmount={buyAmount}
                            onSellTokenChange={setSellToken}
                            onBuyTokenChange={setBuyToken}
                            onSellAmountChange={setSellAmount}
                            onBuyAmountChange={setBuyAmount}
                            onSwap={handleSwap}
                            buttonText={getButtonText()}
                            isButtonDisabled={isButtonDisabled()}
                            isLoading={isLoading}
                            error={error}
                        />

                        {/* Debug Information */}
                        <div className="mt-6 p-4 bg-black/20 border border-crownie-orange/20 rounded-lg">
                            <h3 className="text-crownie-orange font-semibold mb-2">Debug Info</h3>
                            <div className="text-xs text-gray-300 space-y-1">
                                <div>Resolver: {(import.meta.env.VITE_RESOLVER_CONTRACT_ADDRESS || '0x689b5A63B715a3bA57a900B58c74dA60F98F1370').slice(0, 10)}...</div>
                                <div>USDT: {'0xf7f007dc8Cb507e25e8b7dbDa600c07FdCF9A75B'.slice(0, 10)}...</div>
                                <div>USDC: {'0x4C2AA252BEe766D3399850569713b55178934849'.slice(0, 10)}...</div>
                                <div>HashLock: {hashLock ? `${hashLock.slice(0, 10)}...${hashLock.slice(-8)}` : 'Not provided'}</div>
                                <div>HashLock Valid: {hashLock ? (hashLock.length === 66 && hashLock.startsWith('0x') ? '✅ Valid bytes32' : '❌ Invalid format') : 'Not provided'}</div>
                                <div>Creation Fee: <span id="creation-fee">Loading...</span></div>
                                <div>Meeting ID: {meetingId || 'Not provided'}</div>
                                <div>Connected Address: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}</div>
                                <div>Status: {isLoading ? '🔄 Processing...' : '✅ Ready'}</div>
                                {error && <div className="text-red-400">Error: {error}</div>}
                                <div>USDT Balance: {userBalance}</div>
                            </div>
                        </div>
                    </div>
                </main>

                <Footer />
            </div>
        </div>
    )
} 