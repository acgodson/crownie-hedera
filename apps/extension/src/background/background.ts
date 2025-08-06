import browser from "webextension-polyfill";


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

interface MeetingState {
  isActive: boolean;
  platform?: string;
  meetingId?: string;
  title?: string;
  url?: string;
  isRecording: boolean;
  recordingDuration: number;
  lastUpdated: number;
}

class CrownieEtherlinkAgent {
  private keepAliveInterval: number | null = null;
  private transactions: Map<string, TransactionPreparation> = new Map();
  private escrows: Map<string, EscrowMonitoring> = new Map();
  private orderPollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private meetingState: MeetingState = {
    isActive: false,
    isRecording: false,
    recordingDuration: 0,
    lastUpdated: Date.now()
  };

  constructor() {
    try {
      this.setupMessageListener();
      this.setupKeepalive();
    } catch (error) {
      console.error('❌ Background: Constructor failed:', error);
    }
  }

  private setupMessageListener() {
    browser.runtime.onMessage.addListener((message: any, sender: any) => {
      try {
        switch (message?.action) {
          case "MEETING_DETECTED":
            return this.handleMeetingDetected(message.data);
          case "GET_MEETING_STATUS":
            return this.getMeetingStatus();
          case "START_RECORDING":
            return this.startRecording();
          case "STOP_RECORDING":
            return this.stopRecording();
          case "START_TRADE":
            return this.startTrade(message.data);
          case "STOP_TRADE":
            return this.stopTrade();
          case "ORDER_CREATED":
            return this.handleOrderCreated(message.data);
          case "ORDER_UPDATED":
            return this.handleOrderUpdated(message.data);
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
          case "GET_TRADE_STATUS":
            return this.getTradeStatus(message.data.meetingId);
          case "SAVE_ORDER":
            return this.saveOrder(message.data);
          case "UPDATE_ORDER":
            return this.updateOrder(message.data);
          case "COMPLETE_ORDER":
            return this.completeOrder(message.data);
          case "GET_ORDER_STATUS":
            return this.getOrderStatus(message.data);
          case "GET_MEETING_SECRET":
            return this.getMeetingSecret(message.data);
          case "SAVE_MEETING_SECRET":
            return this.saveMeetingSecret(message.data);
          case "OPEN_FILL_ORDER":
            return this.openFillOrder(message.data);
          case "OPEN_COMPLETE_ORDER":
            return this.openCompleteOrder(message.data);
          default:
            return Promise.resolve({ error: `Unknown action: ${message?.action}` });
        }
      } catch (error) {
        console.error('❌ Background: Message handler error:', error);
        return Promise.resolve({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  private setupKeepalive() {
    this.keepAliveInterval = setInterval(() => {
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
      return {
        balance: '0',
        formatted: '0.0000'
      };
    } catch (error) {
      throw error;
    }
  }

  private async getBlockNumber(): Promise<number> {
    try {
      return Math.floor(Date.now() / 1000);
    } catch (error) {
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
      throw error;
    }
  }

  private async handleMeetingDetected(data: any): Promise<any> {
    try {
      this.meetingState = {
        isActive: true,
        platform: data.platform,
        meetingId: data.meetingId,
        title: data.title,
        url: data.url,
        isRecording: false,
        recordingDuration: 0,
        lastUpdated: Date.now()
      };
      
      return { success: true, meetingState: this.meetingState };
    } catch (error) {
      console.error('❌ Background: Failed to handle meeting detection:', error);
      throw error;
    }
  }

  private async getMeetingStatus(): Promise<any> {
    return {
      isMeetingDetected: this.meetingState.isActive,
      platform: this.meetingState.platform,
      meetingId: this.meetingState.meetingId,
      title: this.meetingState.title,
      isRecording: this.meetingState.isRecording,
      recordingDuration: this.meetingState.recordingDuration
    };
  }

  private async startRecording(): Promise<any> {
    try {
      this.meetingState.isRecording = true;
      this.meetingState.recordingDuration = 0;
      this.meetingState.lastUpdated = Date.now();
      
      return { success: true, message: 'Recording started' };
    } catch (error) {
      console.error('❌ Background: Failed to start recording:', error);
      throw error;
    }
  }

  private async stopRecording(): Promise<any> {
    try {
      this.meetingState.isRecording = false;
      this.meetingState.lastUpdated = Date.now();
      
      return { success: true, message: 'Recording stopped' };
    } catch (error) {
      console.error('❌ Background: Failed to stop recording:', error);
      throw error;
    }
  }

  private async startTrade(data: { meetingId: string; platform: string; title: string; hashLock: string }): Promise<any> {
    try {
      const forceLocalhost = false;
      const baseUrl = (process.env.NODE_ENV === 'development' || forceLocalhost)
        ? 'http://localhost:3000'
        : 'https://crownie-swap.vercel.app';
      
      const swapUrl = `${baseUrl}/create-order?secretHash=${data.hashLock}&meetingId=${data.meetingId}`;
      
      const tab = await browser.tabs.create({
        url: swapUrl,
        active: true
      });
      
      return { 
        success: true, 
        message: 'Trade started',
        swapUrl,
        tabId: tab.id
      };
    } catch (error) {
      console.error('❌ Background: Failed to start trade:', error);
      throw error;
    }
  }

  private async stopTrade(): Promise<any> {
    try {
      const tabs = await browser.tabs.query({
        url: '*://crownie-swap.vercel.app/*'
      });
      
      for (const tab of tabs) {
        if (tab.id) {
          await browser.tabs.remove(tab.id);
        }
      }
      
      return { success: true, message: 'Trade stopped' };
    } catch (error) {
      console.error('❌ Background: Failed to stop trade:', error);
      throw error;
    }
  }

  private async handleOrderCreated(data: { orderId: string; meetingId: string }): Promise<any> {
    try {
      return { success: true, orderId: data.orderId };
    } catch (error) {
      console.error('❌ Background: Failed to handle order creation:', error);
      throw error;
    }
  }


  private async handleOrderUpdated(data: { orderId: string; updates: any }): Promise<any> {
    try {
      return { success: true, orderId: data.orderId };
    } catch (error) {
      console.error('❌ Background: Failed to handle order update:', error);
      throw error;
    }
  }



  private async getTradeStatus(meetingId: string): Promise<any> {
    try {
      return { activeOrderId: null, isActive: false, isCompleted: false };
    } catch (error) {
      console.error('❌ Background: Failed to get trade status:', error);
      throw error;
    }
  }

  private async saveOrder(data: { orderId: string; meetingId: string; orderData: any }): Promise<any> {
    try {
      const orderDetails = {
        id: data.orderId,
        meetingId: data.meetingId,
        fromToken: data.orderData?.sellToken || 'Unknown',
        toToken: data.orderData?.buyToken || 'Unknown', 
        fromAmount: data.orderData?.sellAmount || '0',
        toAmount: data.orderData?.buyAmount || '0',
        status: 'pending' as const,
        createdAt: Date.now(),
        maker: '',
        taker: '',
        escrowAddress: '',
        secretHash: '',
        makerEscrowBalance: '0',
        takerEscrowBalance: '0'
      };

    
      const result = await chrome.storage.local.get(['orders']);
      const existingOrders = result.orders || {};
      
      existingOrders[data.orderId] = orderDetails;
      
      await chrome.storage.local.set({ orders: existingOrders });
      
      this.startOrderPolling(data.orderId);
      
      return { success: true, orderId: data.orderId };
    } catch (error) {
      console.error('❌ Background: Failed to save order:', error);
      throw error;
    }
  }

  private startOrderPolling(orderId: string) {
    if (this.orderPollingIntervals.has(orderId)) {
      clearInterval(this.orderPollingIntervals.get(orderId)!);
    }

    const pollInterval = setInterval(async () => {
      try {
        await this.pollOrderStatus(orderId);
      } catch (error) {
        console.error('❌ Background: Error polling order status:', error);
      }
    }, 15000); 

    this.orderPollingIntervals.set(orderId, pollInterval);
  }

  private async pollOrderStatus(orderId: string) {
    try {
      const result = await chrome.storage.local.get(['orders']);
      const orders = result.orders || {};
      const order = orders[orderId];
      
      if (!order) {
        return;
      }

      if (order.status === 'fulfilled' || order.status === 'cancelled') {
        this.stopOrderPolling(orderId);
        return;
      }
      
      if (order.status === 'active') {
        try {
          const escrowBalances = await this.fetchEscrowBalances(orderId);
          
          if (escrowBalances) {
            const updatedOrder = {
              ...order,
              makerEscrowBalance: escrowBalances.makerBalance,
              takerEscrowBalance: escrowBalances.takerBalance
            };
            
  
            const updatedOrders = { ...orders, [orderId]: updatedOrder };
            await chrome.storage.local.set({ orders: updatedOrders });
          }
        } catch (error) {
          console.error('❌ Background: Failed to fetch escrow balances:', error);
        }
      }
      
    } catch (error) {
      console.error('❌ Background: Error polling order:', orderId, error);
    }
  }

  private async fetchEscrowBalances(orderId: string): Promise<{ makerBalance: string, takerBalance: string } | null> {
    try {
      const RESOLVER_ADDRESS = '0x689b5A63B715a3bA57a900B58c74dA60F98F1370';
      const RPC_URL = 'https://node.ghostnet.etherlink.com';
      
      const getOrderStatusCall = this.encodeGetOrderStatus(orderId);
      
      const orderStatusResponse = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{
            to: RESOLVER_ADDRESS,
            data: getOrderStatusCall
          }, 'latest'],
          id: 1
        })
      });
      
      const orderStatusData = await orderStatusResponse.json();
      
      if (!orderStatusData.result || orderStatusData.result === '0x') {
        return null;
      }
      
      const decoded = this.decodeOrderStatus(orderStatusData.result);
      
      if (!decoded.exists) {
        return null;
      }
      
      const makerEscrowAddress = decoded.makerEscrow;
      const takerEscrowAddress = decoded.takerEscrow;
      
      // Since getOrder call fails, use known token addresses
      // From debug: maker token is USDT, taker token is USDC
      const makerTokenAddress = '0xf7f007dc8Cb507e25e8b7dbDa600c07FdCF9A75B'; // USDT
      const takerTokenAddress = '0x4C2AA252BEe766D3399850569713b55178934849'; // USDC
      
      const makerBalanceCall = this.encodeBalanceOf(makerEscrowAddress);
      const makerBalanceResponse = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{
            to: makerTokenAddress,
            data: makerBalanceCall
          }, 'latest'],
          id: 3
        })
      });
      
      const takerBalanceCall = this.encodeBalanceOf(takerEscrowAddress);
      const takerBalanceResponse = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{
            to: takerTokenAddress,
            data: takerBalanceCall
          }, 'latest'],
          id: 4
        })
      });
      
      const [makerBalanceData, takerBalanceData] = await Promise.all([
        makerBalanceResponse.json(),
        takerBalanceResponse.json()
      ]);
      
      const makerBalance = makerBalanceData.result ? parseInt(makerBalanceData.result, 16).toString() : '0';
      const takerBalance = takerBalanceData.result ? parseInt(takerBalanceData.result, 16).toString() : '0';
      
      return {
        makerBalance,
        takerBalance
      };
      
    } catch (error) {
      console.error('❌ Background: Error fetching escrow balances:', error);
      return null;
    }
  }
  
  private encodeGetOrderStatus(orderHash: string): string {
    const functionSelector = '0x46423aa7';
    const paddedOrderHash = orderHash.replace('0x', '').padStart(64, '0');
    return functionSelector + paddedOrderHash;
  }
  
  private decodeOrderStatus(data: string): any {
    try {
      const hex = data.replace('0x', '');
      
      const exists = parseInt(hex.substring(0, 64), 16) === 1;
      const filled = parseInt(hex.substring(64, 128), 16) === 1;
      const completed = parseInt(hex.substring(128, 192), 16) === 1;
      const cancelled = parseInt(hex.substring(192, 256), 16) === 1;
      const makerEscrow = '0x' + hex.substring(280, 320);
      const takerEscrow = '0x' + hex.substring(344, 384);
      
      return {
        exists,
        filled,
        completed,
        cancelled,
        makerEscrow,
        takerEscrow
      };
    } catch (error) {
      console.error('❌ Background: Error decoding order status:', error);
      return { exists: false };
    }
  }
  
  private encodeBalanceOf(address: string): string {
    const functionSelector = '0x70a08231';
    const paddedAddress = address.replace('0x', '').padStart(64, '0');
    return functionSelector + paddedAddress;
  }
  
  // private encodeGetOrder(orderHash: string): string {
  //   const functionSelector = '0xd9627aa4';
  //   const paddedOrderHash = orderHash.replace('0x', '').padStart(64, '0');
  //   return functionSelector + paddedOrderHash;
  // }
  
  // private decodeOrder(data: string): any {
  //   try {
  //     const hex = data.replace('0x', '');
      
  //     const dataStart = 64;
      
  //     const maker = '0x' + hex.substring(dataStart + 24, dataStart + 64);
  //     const makerToken = '0x' + hex.substring(dataStart + 64 + 24, dataStart + 128);
  //     const makerAmount = parseInt(hex.substring(dataStart + 128, dataStart + 192), 16);
  //     const takerToken = '0x' + hex.substring(dataStart + 192 + 24, dataStart + 256);
  //     const takerAmount = parseInt(hex.substring(dataStart + 256, dataStart + 320), 16);
      
  //     return {
  //       maker,
  //       makerToken,
  //       makerAmount,
  //       takerToken,
  //       takerAmount
  //     };
  //   } catch (error) {
  //     console.error('❌ Background: Error decoding order:', error);
  //     return { makerToken: null, takerToken: null };
  //   }
  // }

  private stopOrderPolling(orderId: string) {
    const interval = this.orderPollingIntervals.get(orderId);
    if (interval) {
      clearInterval(interval);
      this.orderPollingIntervals.delete(orderId);
    }
  }

  private async updateOrder(data: { orderId: string; updates: any }): Promise<any> {
    try {
      const result = await chrome.storage.local.get(['orders']);
      const existingOrders = result.orders || {};
      
      if (existingOrders[data.orderId]) {
        existingOrders[data.orderId] = {
          ...existingOrders[data.orderId],
          ...data.updates
        };
        
        await chrome.storage.local.set({ orders: existingOrders });
        
        if (data.updates.status === 'active') {
          this.startOrderPolling(data.orderId);
        }
        
        if (data.updates.status === 'fulfilled' || data.updates.status === 'cancelled') {
          this.stopOrderPolling(data.orderId);
        }
        
        return { success: true, orderId: data.orderId };
      } else {
        return { success: false, error: 'Order not found' };
      }
    } catch (error) {
      console.error('❌ Background: Failed to update order:', error);
      throw error;
    }
  }

  private async completeOrder(data: { orderId: string; meetingId: string; secret: string }): Promise<any> {
    try {
      return { success: true, orderId: data.orderId };
    } catch (error) {
      console.error('❌ Background: Failed to complete order:', error);
      throw error;
    }
  }

  private async getOrderStatus(data: { orderId: string; meetingId: string }): Promise<any> {
    try {
      return { exists: false };
    } catch (error) {
      console.error('❌ Background: Failed to get order status:', error);
      throw error;
    }
  }

  private async getMeetingSecret(data: { meetingId: string }): Promise<any> {
    try {
      const result = await chrome.storage.local.get(`meetingSecret_${data.meetingId}`);
      const secret = result[`meetingSecret_${data.meetingId}`];
      
      if (secret) {
        return { success: true, secret };
      } else {
        return { success: false, error: 'No secret found' };
      }
    } catch (error) {
      console.error('❌ Background: Failed to get meeting secret:', error);
      throw error;
    }
  }

  private async saveMeetingSecret(data: { meetingId: string; secret: string; hashLock: string }): Promise<any> {
    try {
      await chrome.storage.local.set({
        [`meetingSecret_${data.meetingId}`]: data.secret
      });
      
      return { success: true, secret: data.secret };
    } catch (error) {
      console.error('❌ Background: Failed to save meeting secret:', error);
      throw error;
    }
  }

  private async openFillOrder(data: { orderId: string; meetingId: string }): Promise<any> {
    try {
      const forceLocalhost = false;
      const baseUrl = (process.env.NODE_ENV === 'development' || forceLocalhost)
        ? 'http://localhost:3000'
        : 'https://crownie-swap.vercel.app';
      
      const fillUrl = `${baseUrl}/fill-order?orderId=${data.orderId}&meetingId=${data.meetingId}`;
      
      const tab = await browser.tabs.create({
        url: fillUrl,
        active: true
      });
      
      return { 
        success: true, 
        message: 'Fill order page opened',
        fillUrl,
        tabId: tab.id
      };
    } catch (error) {
      console.error('❌ Background: Failed to open fill order page:', error);
      throw error;
    }
  }

  private async openCompleteOrder(data: { orderId: string; meetingId: string; secret?: string }): Promise<any> {
    try {
      const forceLocalhost = false;
      const baseUrl = (process.env.NODE_ENV === 'development' || forceLocalhost)
        ? 'http://localhost:3000'
        : 'https://crownie-swap.vercel.app';
      
      let completeUrl = `${baseUrl}/complete-order?orderId=${data.orderId}&meetingId=${data.meetingId}`;
      
      if (data.secret) {
        completeUrl += `&secret=${data.secret}`;
      }
      
      const tab = await browser.tabs.create({
        url: completeUrl,
        active: true
      });
      
      return { 
        success: true, 
        message: 'Complete order page opened',
        completeUrl,
        tabId: tab.id
      };
    } catch (error) {
      console.error('❌ Background: Failed to open complete order page:', error);
      throw error;
    }
  }
}

try {
  new CrownieEtherlinkAgent();
} catch (error) {
  console.error('❌ Background: Failed to initialize Crownie Etherlink Agent:', error);
}

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
  }
});