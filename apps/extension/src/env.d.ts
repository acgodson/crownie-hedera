/// <reference types="vite/client" />
/// <reference types="chrome" />

// Ethereum provider types
interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>
  on: (event: string, handler: (...args: any[]) => void) => void
  removeListener: (event: string, handler: (...args: any[]) => void) => void
  isMetaMask?: boolean
}

// Extend Window interface for Ethereum
interface Window {
  ethereum?: EthereumProvider
}

// Chrome extension globals
declare const chrome: typeof chrome
declare const browser: typeof browser

// Global types for extension
interface ExtensionMessage {
  action: string
  data?: any
}

interface TransactionPreparation {
  id: string
  title: string
  to: string
  value: string
  data?: string
  status: 'draft' | 'prepared' | 'ready'
  createdAt: number
  etherlinkTxHash?: string
}

interface EscrowMonitoring {
  escrowAddress: string
  secretHash: string
  timelock: number
  amount: string
  token: string
  status: 'locked' | 'revealed' | 'expired'
}