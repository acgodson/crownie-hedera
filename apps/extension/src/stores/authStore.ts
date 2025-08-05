import { create } from 'zustand'

interface EtherlinkState {
  // Connection state
  isConnected: boolean
  address: string | null
  chainId: number | null
  isLoading: boolean
  error: string | null

  // Transaction preparation
  transactions: TransactionPreparation[]
  escrows: EscrowMonitoring[]

  // Actions
  init: () => Promise<void>
  connect: () => Promise<void>
  connectDirect: () => Promise<void>
  checkDirectEthereumAccess: () => Promise<void>
  disconnect: () => void
  clearError: () => void
  addTransaction: (tx: TransactionPreparation) => void
  addEscrow: (escrow: EscrowMonitoring) => void
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

// Etherlink testnet configuration
const ETHERLINK_TESTNET_CHAIN_ID = 128123

export const useEtherlinkStore = create<EtherlinkState>((set, get) => ({
  // Initial state
  isConnected: false,
  address: null,
  chainId: null,
  isLoading: false,
  error: null,
  transactions: [],
  escrows: [],

  clearError: () => set({ error: null }),

  init: async () => {
    try {
      console.log('🔍 EtherlinkStore: Starting initialization...')
      set({ isLoading: true, error: null })

      // For extension context, we need to check via content script injection
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        // Extension context - inject script to check for MetaMask
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
          if (tabs[0]?.id) {
            const result = await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: () => {
                return {
                  hasEthereum: typeof window.ethereum !== 'undefined',
                  isMetaMask: window.ethereum?.isMetaMask || false,
                  accounts: window.ethereum ? [] : [] // We'll get accounts on connect
                }
              }
            })
            
            if (result[0]?.result?.hasEthereum) {
              console.log('✅ EtherlinkStore: MetaMask detected via content script')
              set({ error: null })
            } else {
              set({ error: 'MetaMask not found. Please install MetaMask extension.' })
            }
          }
        } catch (scriptError) {
          console.log('⚠️ EtherlinkStore: Could not inject script, trying direct access...')
          // Fallback to direct window.ethereum check
          await get().checkDirectEthereumAccess()
        }
      } else {
        // Direct window access (web app context)
        await get().checkDirectEthereumAccess()
      }
    } catch (error) {
      console.error('❌ EtherlinkStore: Initialization failed:', error)
      set({
        error: error instanceof Error ? error.message : 'Initialization failed'
      })
    } finally {
      set({ isLoading: false })
      
      const state = get()
      console.log('🔍 EtherlinkStore: Initialization complete. Final state:', {
        isConnected: state.isConnected,
        address: state.address,
        chainId: state.chainId,
        error: state.error
      })
    }
  },

  checkDirectEthereumAccess: async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      // Check if already connected
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' })
          set({
            isConnected: true,
            address: accounts[0],
            chainId: parseInt(chainId, 16),
            error: null
          })
          console.log('✅ EtherlinkStore: Already connected to:', accounts[0])
        }
      } catch (error) {
        console.error('Error checking existing connection:', error)
      }
    } else {
      console.log('⚠️ EtherlinkStore: No Ethereum provider found')
      set({ error: 'No Ethereum wallet found. Please install MetaMask or another wallet.' })
    }
  },

  connect: async () => {
    try {
      set({ isLoading: true, error: null })
      console.log('🔍 EtherlinkStore: Starting connection process...')

      // For extension context, we need to inject script into active tab
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tabs[0]?.id) {
          // Check if we're on a chrome:// URL which doesn't allow script injection
          if (tabs[0].url?.startsWith('chrome://') || tabs[0].url?.startsWith('chrome-extension://')) {
            throw new Error('CHROME_URL_RESTRICTION')
          }

          const result = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: async () => {
              const ETHERLINK_TESTNET_CHAIN_ID = 128123
              
              if (!window.ethereum) {
                throw new Error('MetaMask not found')
              }

              // Request account access
              const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
              })

              if (accounts.length === 0) {
                throw new Error('No accounts found')
              }

              // Get current chain ID
              const chainId = await window.ethereum.request({ method: 'eth_chainId' })
              const chainIdNumber = parseInt(chainId, 16)

              // Check if we're on Etherlink testnet, if not, try to switch
              if (chainIdNumber !== ETHERLINK_TESTNET_CHAIN_ID) {
                try {
                  await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${ETHERLINK_TESTNET_CHAIN_ID.toString(16)}` }],
                  })
                } catch (switchError: any) {
                  // If the chain doesn't exist, add it
                  if (switchError.code === 4902) {
                    await window.ethereum.request({
                      method: 'wallet_addEthereumChain',
                      params: [{
                        chainId: `0x${ETHERLINK_TESTNET_CHAIN_ID.toString(16)}`,
                        chainName: 'Etherlink Testnet',
                        nativeCurrency: {
                          name: 'Ether',
                          symbol: 'ETH',
                          decimals: 18,
                        },
                        rpcUrls: ['https://node.ghostnet.etherlink.com'],
                        blockExplorerUrls: ['https://testnet-explorer.etherlink.com'],
                      }],
                    })
                  } else {
                    throw switchError
                  }
                }
              }

              return {
                address: accounts[0],
                chainId: ETHERLINK_TESTNET_CHAIN_ID,
                success: true
              }
            }
          })

          const connectionResult = result[0]?.result
          if (connectionResult?.success) {
            set({
              isConnected: true,
              address: connectionResult.address,
              chainId: connectionResult.chainId,
              isLoading: false,
              error: null
            })
            
            console.log('✅ EtherlinkStore: Connected successfully to:', connectionResult.address)
          } else {
            throw new Error('Connection failed')
          }
        } else {
          throw new Error('No active tab found')
        }
      } else {
        // Fallback to direct connection (web app context)
        await get().connectDirect()
      }
    } catch (error) {
      console.error('❌ EtherlinkStore: Connection failed:', error)
      
      let errorMessage = error instanceof Error ? error.message : 'Connection failed'
      
      // Handle chrome:// URL restriction with helpful message
      if (error instanceof Error && (
        error.message === 'CHROME_URL_RESTRICTION' ||
        error.message.includes('Cannot access a chrome:// URL') ||
        error.message.includes('chrome-extension://')
      )) {
        errorMessage = 'Please navigate to a regular webpage (like google.com) before connecting your wallet. Chrome extensions cannot access chrome:// pages for security reasons.'
      }
      
      set({
        isLoading: false,
        error: errorMessage
      })
    }
  },

  connectDirect: async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      set({ error: 'No Ethereum wallet found. Please install MetaMask or another wallet.' })
      return
    }

    // Request account access
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    })

    if (accounts.length === 0) {
      throw new Error('No accounts found')
    }

    // Get current chain ID
    const chainId = await window.ethereum.request({ method: 'eth_chainId' })
    const chainIdNumber = parseInt(chainId, 16)

    // Check if we're on Etherlink testnet, if not, try to switch
    if (chainIdNumber !== ETHERLINK_TESTNET_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${ETHERLINK_TESTNET_CHAIN_ID.toString(16)}` }],
        })
      } catch (switchError: any) {
        // If the chain doesn't exist, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${ETHERLINK_TESTNET_CHAIN_ID.toString(16)}`,
              chainName: 'Etherlink Testnet',
              nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['https://node.ghostnet.etherlink.com'],
              blockExplorerUrls: ['https://testnet-explorer.etherlink.com'],
            }],
          })
        } else {
          throw switchError
        }
      }
    }

    set({
      isConnected: true,
      address: accounts[0],
      chainId: ETHERLINK_TESTNET_CHAIN_ID,
      error: null
    })

    // Set up event listeners for account and chain changes
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        get().disconnect()
      } else {
        set({ address: accounts[0] })
      }
    })

    window.ethereum.on('chainChanged', (chainId: string) => {
      set({ chainId: parseInt(chainId, 16) })
    })
  },

  disconnect: () => {
    set({
      isConnected: false,
      address: null,
      chainId: null,
      error: null
    })
    console.log('✅ EtherlinkStore: Disconnected successfully')
  },

  addTransaction: (tx: TransactionPreparation) => {
    set(state => ({
      transactions: [...state.transactions, tx]
    }))
  },

  addEscrow: (escrow: EscrowMonitoring) => {
    set(state => ({
      escrows: [...state.escrows, escrow]
    }))
  }
}))

// Backward compatibility alias
export const useAuthStore = useEtherlinkStore