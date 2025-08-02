import { Actor, HttpAgent } from '@dfinity/agent'
import { AuthClient } from '@dfinity/auth-client'
import { Principal } from '@dfinity/principal'
import type { 
  ICPSwapRequest, 
  ICPSwapResponse, 
  CrossChainSwapOrder,
  HTLCContract 
} from '@crownie-bridge/shared-types'

// Candid interface for our cross-chain swap canister
const swapCanisterIdl = ({ IDL }: any) => {
  const SwapOrder = IDL.Record({
    orderId: IDL.Text,
    maker: IDL.Text,
    sellAmount: IDL.Text,
    buyAmount: IDL.Text,
    hashlock: IDL.Text,
    timelock: IDL.Nat64,
    status: IDL.Text
  })

  const HTLCContract = IDL.Record({
    contractId: IDL.Text,
    sender: IDL.Text,
    receiver: IDL.Text,
    amount: IDL.Text,
    hashlock: IDL.Text,
    timelock: IDL.Nat64,
    withdrawn: IDL.Bool,
    refunded: IDL.Bool
  })

  const SwapRequest = IDL.Record({
    order: SwapOrder,
    ethTxHash: IDL.Opt(IDL.Text),
    signature: IDL.Opt(IDL.Text)
  })

  const SwapResponse = IDL.Record({
    success: IDL.Bool,
    message: IDL.Text,
    contractId: IDL.Opt(IDL.Text),
    txHash: IDL.Opt(IDL.Text)
  })

  return IDL.Service({
    createHTLC: IDL.Func([SwapRequest], [SwapResponse], []),
    fulfillHTLC: IDL.Func([IDL.Text, IDL.Text], [SwapResponse], []), // contractId, preimage
    refundHTLC: IDL.Func([IDL.Text], [SwapResponse], []), // contractId
    getHTLC: IDL.Func([IDL.Text], [IDL.Opt(HTLCContract)], ['query']),
    getOrderStatus: IDL.Func([IDL.Text], [IDL.Opt(SwapOrder)], ['query']),
    signEthereumTransaction: IDL.Func([IDL.Vec(IDL.Nat8)], [IDL.Vec(IDL.Nat8)], []), // For threshold ECDSA
  })
}

export class ICPService {
  private agent: HttpAgent | null = null
  private authClient: AuthClient | null = null
  private actor: any = null
  private canisterId: string

  constructor(canisterId: string = 'rdmx6-jaaaa-aaaah-qdrqq-cai') {
    this.canisterId = canisterId
  }

  async initialize(): Promise<void> {
    try {
      // Initialize auth client
      this.authClient = await AuthClient.create()
      
      // Check if already authenticated
      const isAuthenticated = await this.authClient.isAuthenticated()
      
      if (!isAuthenticated) {
        console.log('Not authenticated with Internet Identity')
        // We'll handle authentication in the UI component
        return
      }

      // Create agent
      this.agent = new HttpAgent({
        host: process.env.IC_HOST || 'https://ic0.app',
        identity: this.authClient.getIdentity()
      })

      // Only fetch root key in development
      if (process.env.NODE_ENV === 'development') {
        await this.agent.fetchRootKey()
      }

      // Create actor
      this.actor = Actor.createActor(swapCanisterIdl, {
        agent: this.agent,
        canisterId: this.canisterId
      })

      console.log('ICP Service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize ICP Service:', error)
      throw error
    }
  }

  async authenticate(): Promise<boolean> {
    if (!this.authClient) {
      throw new Error('Auth client not initialized')
    }

    return new Promise((resolve, reject) => {
      this.authClient!.login({
        identityProvider: process.env.II_URL || 'https://identity.ic0.app',
        onSuccess: async () => {
          await this.initialize() // Re-initialize with authenticated identity
          resolve(true)
        },
        onError: (error) => {
          console.error('Authentication failed:', error)
          reject(error)
        }
      })
    })
  }

  async logout(): Promise<void> {
    if (this.authClient) {
      await this.authClient.logout()
      this.agent = null
      this.actor = null
    }
  }

  async isAuthenticated(): Promise<boolean> {
    return this.authClient?.isAuthenticated() || false
  }

  getPrincipal(): Principal | null {
    return this.authClient?.getIdentity()?.getPrincipal() || null
  }

  async createHTLC(request: ICPSwapRequest): Promise<ICPSwapResponse> {
    if (!this.actor) {
      throw new Error('ICP Service not initialized or not authenticated')
    }

    try {
      const swapRequest = {
        order: {
          orderId: request.order.orderId,
          maker: request.order.maker,
          sellAmount: request.order.sellAmount,
          buyAmount: request.order.buyAmount,
          hashlock: request.order.hashlock,
          timelock: BigInt(request.order.deadline),
          status: request.order.status
        },
        ethTxHash: request.ethTxHash ? [request.ethTxHash] : [],
        signature: request.signature ? [request.signature] : []
      }

      const response = await this.actor.createHTLC(swapRequest)
      return response
    } catch (error) {
      console.error('Failed to create HTLC on ICP:', error)
      throw new Error(`HTLC creation failed: ${error}`)
    }
  }

  async fulfillHTLC(contractId: string, preimage: string): Promise<ICPSwapResponse> {
    if (!this.actor) {
      throw new Error('ICP Service not initialized or not authenticated')
    }

    try {
      const response = await this.actor.fulfillHTLC(contractId, preimage)
      return response
    } catch (error) {
      console.error('Failed to fulfill HTLC:', error)
      throw new Error(`HTLC fulfillment failed: ${error}`)
    }
  }

  async refundHTLC(contractId: string): Promise<ICPSwapResponse> {
    if (!this.actor) {
      throw new Error('ICP Service not initialized or not authenticated')
    }

    try {
      const response = await this.actor.refundHTLC(contractId)
      return response
    } catch (error) {
      console.error('Failed to refund HTLC:', error)
      throw new Error(`HTLC refund failed: ${error}`)
    }
  }

  async getHTLC(contractId: string): Promise<HTLCContract | null> {
    if (!this.actor) {
      throw new Error('ICP Service not initialized')
    }

    try {
      const response = await this.actor.getHTLC(contractId)
      return response.length > 0 ? response[0] : null
    } catch (error) {
      console.error('Failed to get HTLC:', error)
      return null
    }
  }

  async getOrderStatus(orderId: string): Promise<CrossChainSwapOrder | null> {
    if (!this.actor) {
      throw new Error('ICP Service not initialized')
    }

    try {
      const response = await this.actor.getOrderStatus(orderId)
      return response.length > 0 ? response[0] : null
    } catch (error) {
      console.error('Failed to get order status:', error)
      return null
    }
  }

  // Threshold ECDSA functionality for signing Ethereum transactions
  async signEthereumTransaction(txHash: Uint8Array): Promise<Uint8Array> {
    if (!this.actor) {
      throw new Error('ICP Service not initialized')
    }

    try {
      const signature = await this.actor.signEthereumTransaction(Array.from(txHash))
      return new Uint8Array(signature)
    } catch (error) {
      console.error('Failed to sign Ethereum transaction:', error)
      throw new Error(`Transaction signing failed: ${error}`)
    }
  }
}

// Singleton instance
let icpService: ICPService | null = null

export const getICPService = (canisterId?: string): ICPService => {
  if (!icpService) {
    icpService = new ICPService(canisterId)
  }
  return icpService
}