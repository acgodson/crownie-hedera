import { useSearchParams } from 'react-router-dom'
import { useAccount, useConnect, useDisconnect, usePublicClient, useWalletClient } from 'wagmi'
import { useEffect, useState } from 'react'
import { useExtensionBridge } from '../hooks/useExtensionBridge'

import RESOLVER from "../assets/Resolver.json";

const RESOLVER_ADDRESS = import.meta.env.VITE_RESOLVER_CONTRACT_ADDRESS || '0x689b5A63B715a3bA57a900B58c74dA60F98F1370'

const RESOLVER_ABI = RESOLVER.abi;

const ERC20_ABI = [
    {
        "inputs": [{ "name": "account", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "spender", "type": "address" },
            { "name": "amount", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const

export default function CompleteSwapWidget() {
    const [searchParams] = useSearchParams()
    const { address, isConnected } = useAccount()
    const { connect, connectors } = useConnect()
    const { disconnect } = useDisconnect()
    const { sendOrderCompleted } = useExtensionBridge()
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string>()
    const [orderStatus, setOrderStatus] = useState<any>(null)
    const [escrowBalances, setEscrowBalances] = useState<{ maker: string, taker: string }>({ maker: '0', taker: '0' })

    const orderId = searchParams.get('orderId')
    const meetingId = searchParams.get('meetingId')
    const secret = searchParams.get('secret')

    // Check order status and escrow balances
    useEffect(() => {
        const checkOrderStatus = async () => {
            if (!publicClient || !orderId) return

            try {
                const status = await publicClient.readContract({
                    address: RESOLVER_ADDRESS as `0x${string}`,
                    abi: RESOLVER_ABI,
                    functionName: 'getOrderStatus',
                    args: [orderId as `0x${string}`]
                }) as [boolean, boolean, boolean, boolean, `0x${string}`, `0x${string}`, `0x${string}`, bigint]

                setOrderStatus(status)

                // Check escrow balances
                if (status[4] && status[5]) { // makerEscrow and takerEscrow are at indices 4 and 5
                    const makerBalance = await publicClient.readContract({
                        address: '0x4C2AA252BEe766D3399850569713b55178934849' as `0x${string}`, // USDC
                        abi: ERC20_ABI,
                        functionName: 'balanceOf',
                        args: [status[4]]
                    })

                    const takerBalance = await publicClient.readContract({
                        address: '0xf7f007dc8Cb507e25e8b7dbDa600c07FdCF9A75B' as `0x${string}`, // USDT
                        abi: ERC20_ABI,
                        functionName: 'balanceOf',
                        args: [status[5]]
                    })

                    setEscrowBalances({
                        maker: makerBalance.toString(),
                        taker: takerBalance.toString()
                    })
                }
            } catch (error) {
                console.error('Failed to check order status:', error)
            }
        }

        checkOrderStatus()
        const interval = setInterval(checkOrderStatus, 10000) // Check every 10 seconds

        return () => clearInterval(interval)
    }, [publicClient, orderId])

    const handleConnect = () => {
        if (connectors[0]) {
            connect({ connector: connectors[0] })
        }
    }

    const handleDisconnect = () => {
        disconnect()
    }

    const handleFillOrder = async () => {
        if (!isConnected || !address || !walletClient || !publicClient || !orderId) {
            handleConnect()
            return
        }

        setIsLoading(true)
        setError(undefined)

        try {
            // This would require the full order data to fill
            setError('Fill order functionality requires full order data. This is a demo.')
        } catch (err) {
            console.error('Failed to fill order:', err)
            setError(err instanceof Error ? err.message : 'Failed to fill order')
        } finally {
            setIsLoading(false)
        }
    }

    const handleCompleteSwap = async () => {
        if (!isConnected || !address || !walletClient || !publicClient || !orderId || !secret || !meetingId) {
            setError('Missing required parameters for swap completion')
            return
        }

        setIsLoading(true)
        setError(undefined)

        try {
            const { request } = await publicClient.simulateContract({
                address: RESOLVER_ADDRESS as `0x${string}`,
                abi: RESOLVER_ABI,
                functionName: 'completeSwap',
                args: [orderId as `0x${string}`, secret],
                account: address
            })

            const hash = await walletClient.writeContract(request)
            await publicClient.waitForTransactionReceipt({ hash })

            console.log('✅ Swap completed successfully:', orderId)

            // Send completion message to extension and wait for confirmation
            console.log('📤 Sending order completion message to extension...')
            const confirmed = await sendOrderCompleted({
                orderId,
                meetingId,
                secret
            })

            if (confirmed) {
                console.log('✅ Extension confirmed order completion, closing window...')
                setTimeout(() => {
                    window.close()
                }, 1000) // Short delay just for user feedback
            } else {
                console.log('❌ Extension did not confirm order completion within timeout')
                // Show error to user but don't close window
                alert('Swap completed but extension did not respond. You can manually close this tab.')
            }

        } catch (err) {
            console.error('Failed to complete swap:', err)
            setError(err instanceof Error ? err.message : 'Failed to complete swap')
        } finally {
            setIsLoading(false)
        }
    }

    const getButtonText = () => {
        if (!isConnected) return 'Connect Wallet'
        if (isLoading) return 'Processing...'
        if (!orderStatus?.[1]) return 'Fill Order' // filled is at index 1
        return 'Complete Swap'
    }

    const isButtonDisabled = () => {
        if (!isConnected) return false
        if (isLoading) return true
        return false
    }

    const handleButtonClick = () => {
        if (!isConnected) {
            handleConnect()
        } else if (!orderStatus?.[1]) { // filled is at index 1
            handleFillOrder()
        } else {
            handleCompleteSwap()
        }
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
                        <div className="w-8 h-8 bg-crownie-orange rounded-lg flex items-center justify-center">
                            <span className="text-black font-bold text-sm">C</span>
                        </div>
                        <span className="text-white font-semibold text-lg">Complete Swap</span>
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
                            Complete Your Swap
                        </h1>

                        <div className="bg-black/40 backdrop-blur-sm border border-crownie-orange/20 rounded-2xl p-6">
                            {/* Order Status */}
                            <div className="mb-6">
                                <h3 className="text-crownie-orange font-semibold mb-4">Order Status</h3>
                                <div className="space-y-2 text-sm text-gray-300">
                                    <div>Order ID: {orderId ? `${orderId.slice(0, 10)}...${orderId.slice(-8)}` : 'Loading...'}</div>
                                    <div>Meeting ID: {meetingId || 'Not provided'}</div>
                                    <div>Status: {orderStatus ? (orderStatus[2] ? '✅ Completed' : orderStatus[1] ? '🟡 Filled' : '⏳ Pending') : 'Loading...'}</div>
                                </div>
                            </div>

                            {/* Escrow Balances */}
                            <div className="mb-6">
                                <h3 className="text-crownie-orange font-semibold mb-4">Escrow Balances</h3>
                                <div className="space-y-2 text-sm text-gray-300">
                                    <div>Maker Escrow (USDC): {escrowBalances.maker}</div>
                                    <div>Taker Escrow (USDT): {escrowBalances.taker}</div>
                                </div>
                            </div>

                            {error && (
                                <div className="text-red-400 text-sm text-center mb-4">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleButtonClick}
                                disabled={isButtonDisabled()}
                                className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${isButtonDisabled()
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-crownie-orange text-black hover:bg-crownie-orange/90'
                                    }`}
                            >
                                {getButtonText()}
                            </button>
                        </div>

                        {/* Debug Information */}
                        <div className="mt-6 p-4 bg-black/20 border border-crownie-orange/20 rounded-lg">
                            <h3 className="text-crownie-orange font-semibold mb-2">Debug Info</h3>
                            <div className="text-xs text-gray-300 space-y-1">
                                <div>Order ID: {orderId || 'Not provided'}</div>
                                <div>Meeting ID: {meetingId || 'Not provided'}</div>
                                <div>Secret: {secret ? `${secret.slice(0, 10)}...${secret.slice(-8)}` : 'Not provided'}</div>
                                <div>Connected Address: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}</div>
                                <div>Status: {isLoading ? '🔄 Processing...' : '✅ Ready'}</div>
                                {error && <div className="text-red-400">Error: {error}</div>}
                            </div>
                        </div>
                    </div>
                </main>

                <footer className="px-6 py-8">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-6 h-6 bg-crownie-orange rounded-lg flex items-center justify-center">
                                <span className="text-black font-bold text-xs">C</span>
                            </div>
                            <span className="text-white font-semibold">Crownie</span>
                        </div>
                        <p className="text-gray-400 text-sm">© 2025 Crownie. All rights reserved.</p>
                    </div>
                </footer>
            </div>
        </div>
    )
} 