console.log('🔧 Background: Starting Crownie Extension background script...');

import browser from "webextension-polyfill";
import { createPublicClient, http } from 'viem';
import { type PublicClient } from 'viem';

console.log('✅ Background: Imports loaded successfully');

// Etherlink testnet configuration
const ETHERLINK_TESTNET = {
  id: 128123,
  name: 'Etherlink Testnet',
  network: 'etherlink-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://node.ghostnet.etherlink.com'],
    },
    public: {
      http: ['https://node.ghostnet.etherlink.com'],
    },
  },
  blockExplorers: {
    default: { name: 'Etherlink Explorer', url: 'https://testnet-explorer.etherlink.com' },
  },
} as const;

interface TransactionPreparation {
  id: string;
  title: string;
  to: string;
  value: string;
  data?: string;
  status: 'draft' | 'prepared' | 'ready';
  createdAt: number;
  etherlinkTxHash?: string;
}

interface EscrowMonitoring {
  escrowAddress: string;
  secretHash: string;
  timelock: number;
  amount: string;
  token: string;
  status: 'locked' | 'revealed' | 'expired';
}

class CrownieEtherlinkAgent {
  private publicClient!: PublicClient;
  private keepAliveInterval: number | null = null;
  private transactions: Map<string, TransactionPreparation> = new Map();
  private escrows: Map<string, EscrowMonitoring> = new Map();

  constructor() {
    console.log('🔧 Background: Starting Crownie Etherlink Agent...');
    
    try {
      this.setupEtherlinkClient();
      this.setupMessageListener();
      this.setupKeepalive();
      
      console.log('✅ Background: Crownie Etherlink Agent constructed successfully');
    } catch (error) {
      console.error('❌ Background: Constructor failed:', error);
    }
  }

  private setupEtherlinkClient() {
    this.publicClient = createPublicClient({
      chain: ETHERLINK_TESTNET,
      transport: http()
    });
    
    console.log('✅ Background: Etherlink client initialized');
  }

  private setupMessageListener() {
    console.log('🔧 Background: Setting up message listener...');
    
    browser.runtime.onMessage.addListener((message: any, sender: any) => {
      console.log('🔍 Background: Received message:', {
        action: message?.action,
        sender: sender?.tab?.url || 'popup',
        timestamp: new Date().toISOString()
      });
      
      try {
        switch (message?.action) {
          case "PREPARE_TRANSACTION":
            return this.prepareTransaction(message.data);
          case "GET_TRANSACTIONS":
            return this.getTransactions();
          case "MONITOR_ESCROW":
            return this.monitorEscrow(message.data);
          case "GET_ESCROWS":
            return this.getEscrows();
          case "GET_ETH_BALANCE":
            return this.getEthBalance(message.data.address);
          case "GET_BLOCK_NUMBER":
            return this.getBlockNumber();
          case "HEALTH_CHECK":
            return this.healthCheck();
          default:
            console.log('🔍 Background: Unknown action:', message?.action);
            return Promise.resolve({ error: `Unknown action: ${message?.action}` });
        }
      } catch (error) {
        console.error('❌ Background: Message handler error:', error);
        return Promise.resolve({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
    
    console.log('✅ Background: Message listener set up successfully');
  }

  private setupKeepalive() {
    this.keepAliveInterval = setInterval(() => {
      console.log('🔄 Background: Keepalive ping');
    }, 20000) as any;
    
    self.addEventListener('beforeunload', () => {
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
      }
    });
  }

  private async prepareTransaction(data: {
    title: string;
    to: string;
    value: string;
    data?: string;
  }): Promise<any> {
    try {
      const transaction: TransactionPreparation = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: data.title,
        to: data.to,
        value: data.value,
        data: data.data,
        status: 'draft',
        createdAt: Date.now()
      };

      this.transactions.set(transaction.id, transaction);
      
      console.log('✅ Background: Transaction prepared:', transaction.id);
      return transaction;
    } catch (error) {
      console.error('❌ Background: Failed to prepare transaction:', error);
      throw error;
    }
  }

  private async getTransactions(): Promise<TransactionPreparation[]> {
    return Array.from(this.transactions.values());
  }

  private async monitorEscrow(data: {
    escrowAddress: string;
    secretHash: string;
    timelock: number;
    amount: string;
    token: string;
  }): Promise<any> {
    try {
      const escrow: EscrowMonitoring = {
        escrowAddress: data.escrowAddress,
        secretHash: data.secretHash,
        timelock: data.timelock,
        amount: data.amount,
        token: data.token,
        status: 'locked'
      };

      this.escrows.set(data.escrowAddress, escrow);
      
      console.log('✅ Background: Escrow monitoring started:', data.escrowAddress);
      return escrow;
    } catch (error) {
      console.error('❌ Background: Failed to monitor escrow:', error);
      throw error;
    }
  }

  private async getEscrows(): Promise<EscrowMonitoring[]> {
    return Array.from(this.escrows.values());
  }

  private async getEthBalance(address: string): Promise<any> {
    try {
      const balance = await this.publicClient.getBalance({
        address: address as `0x${string}`
      });
      
      return {
        balance: balance.toString(),
        formatted: (Number(balance) / 1e18).toFixed(4)
      };
    } catch (error) {
      console.error('❌ Background: Failed to get ETH balance:', error);
      throw error;
    }
  }

  private async getBlockNumber(): Promise<number> {
    try {
      const blockNumber = await this.publicClient.getBlockNumber();
      return Number(blockNumber);
    } catch (error) {
      console.error('❌ Background: Failed to get block number:', error);
      throw error;
    }
  }

  private async healthCheck(): Promise<any> {
    try {
      const blockNumber = await this.getBlockNumber();
      return {
        status: 'healthy',
        chain: 'etherlink-testnet',
        blockNumber,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Background: Health check failed:', error);
      throw error;
    }
  }
}

// Initialize the Crownie Etherlink agent
try {
  console.log('🔧 Background: Initializing Crownie Etherlink Agent...');
  new CrownieEtherlinkAgent();
  console.log('✅ Background: Crownie Etherlink Agent initialized successfully');
} catch (error) {
  console.error('❌ Background: Failed to initialize Crownie Etherlink Agent:', error);
}

// Handle extension installation
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Crownie extension installed");
  }
});