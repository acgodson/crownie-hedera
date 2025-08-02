// packages/shared-types/src/index.ts

export enum ChainId {
  ETHEREUM = 1,
  SEPOLIA = 11155111,
  ICP = "ic",
}

export enum SwapStatus {
  PENDING = "pending",
  LOCKED = "locked",
  COMPLETED = "completed",
  REFUNDED = "refunded",
  EXPIRED = "expired",
  FAILED = "failed",
}

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  chainId: ChainId;
  logoURI?: string;
}

export interface CrossChainSwapOrder {
  orderId: string;
  maker: string;
  sellToken: Token;
  buyToken: Token;
  sellAmount: string;
  buyAmount: string;
  sourceChain: ChainId;
  destinationChain: ChainId;
  deadline: number;
  hashlock: string;
  secret?: string;
  status: SwapStatus;
  createdAt: number;
  updatedAt: number;
}

export interface HTLCContract {
  contractId: string;
  sender: string;
  receiver: string;
  amount: string;
  hashlock: string;
  timelock: number;
  withdrawn: boolean;
  refunded: boolean;
  preimage?: string;
}

export interface SwapQuote {
  sellAmount: string;
  buyAmount: string;
  price: string;
  guaranteedPrice: string;
  estimatedGas: string;
  sources: Array<{
    name: string;
    proportion: string;
  }>;
}

// 1inch Fusion+ specific interfaces
export interface FusionOrderParams {
  makerAsset: string;
  takerAsset: string;
  amount: string;
  taker: string;
  maker: string;
  allowedSender?: string;
  makingAmount: string;
  takingAmount: string;
  predicate?: string;
  permit?: string;
  interactions?: string;
}

export interface FusionQuoteParams {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  walletAddress: string;
  slippagePercentage?: number;
  feePercent?: number;
  isPermit2?: boolean;
}

// ICP Canister interfaces
export interface ICPSwapRequest {
  order: CrossChainSwapOrder;
  ethTxHash?: string;
  signature?: string;
}

export interface ICPSwapResponse {
  success: boolean;
  message: string;
  contractId?: string;
  txHash?: string;
}

export interface SwapError {
  code: string;
  message: string;
  details?: any;
}

export interface SwapEvent {
  type:
    | "HTLC_CREATED"
    | "HTLC_FULFILLED"
    | "HTLC_REFUNDED"
    | "ORDER_CREATED"
    | "ORDER_FILLED";
  orderId: string;
  data: any;
  timestamp: number;
  chainId: ChainId;
}
