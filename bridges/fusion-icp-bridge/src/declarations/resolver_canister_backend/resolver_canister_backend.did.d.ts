import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AuctionDetails {
  'duration' : bigint,
  'start_time' : bigint,
  'initial_rate_bump' : number,
  'gas_price' : bigint,
}
export interface AuctionPoint { 'coefficient' : number, 'delay' : bigint }
export interface BidResult {
  'bid_accepted' : boolean,
  'order_hash' : string,
  'profitability_score' : number,
  'estimated_profit' : bigint,
}
export interface BridgeConfig {
  'source_chain' : ChainConfig,
  'max_gas_limit' : bigint,
  'destination_chain' : ChainConfig,
  'bridge_contract' : string,
  'min_confirmation_blocks' : bigint,
}
export interface ChainConfig {
  'explorer_url' : string,
  'block_time' : bigint,
  'native_currency' : string,
  'chain_id' : bigint,
  'rpc_url' : string,
}
export interface CrossChainOrder {
  'maker' : string,
  'src_chain_id' : bigint,
  'time_lock' : bigint,
  'maker_asset' : string,
  'taking_amount' : bigint,
  'making_amount' : bigint,
  'dst_chain_id' : bigint,
  'hash_lock' : Uint8Array | number[],
  'order_hash' : string,
  'taker_asset' : string,
  'auction_details' : AuctionDetails,
}
export interface EscrowPair {
  'ethereum_escrow' : string,
  'icp_escrow' : string,
}
export interface HttpHeader { 'value' : string, 'name' : string }
export interface HttpResponse {
  'status' : bigint,
  'body' : Uint8Array | number[],
  'headers' : Array<HttpHeader>,
}
export interface OneInchOrder {
  'maker' : string,
  'auction_start_date' : bigint,
  'status' : [] | [OrderStatus],
  'maker_asset' : string,
  'taking_amount' : string,
  'creation_timestamp' : bigint,
  'making_amount' : string,
  'hash' : string,
  'auction_duration' : bigint,
  'salt' : string,
  'maker_traits' : string,
  'taker_asset' : string,
  'initial_rate_bump' : number,
  'receiver' : string,
  'points' : Array<AuctionPoint>,
  'settlement' : [] | [SettlementData],
}
export interface OneInchQuoteResponse {
  'dst_amount' : string,
  'guaranteed_price' : [] | [string],
  'price_impact' : [] | [number],
  'sources' : [] | [Array<QuoteSource>],
  'estimated_gas' : bigint,
  'gas_price' : string,
}
export interface OrderStatus {
  'status' : string,
  'cancelled_at' : [] | [bigint],
  'filled_at' : [] | [bigint],
  'remaining_making_amount' : string,
  'expires_at' : bigint,
}
export interface QuoteSource { 'name' : string, 'proportion' : string }
export interface ResolverConfig {
  'custom_rpc_url' : [] | [string],
  'alchemy_api_key' : [] | [string],
  'max_gas_price' : bigint,
  'bridge_config' : [] | [BridgeConfig],
  'oneinch_api_key' : [] | [string],
  'min_profit_threshold' : bigint,
  'supported_tokens' : Array<string>,
  'evm_rpc_canister' : Principal,
}
export type ResolverError = { 'InvalidInput' : string } |
  { 'NetworkError' : string } |
  { 'ContractError' : string } |
  { 'OrderNotFound' : string } |
  { 'ProcessingError' : string } |
  { 'InsufficientCycles' : string } |
  { 'InsufficientLiquidity' : string } |
  { 'ExternalCallError' : string } |
  { 'SlippageExceeded' : string };
export type Result = { 'Ok' : null } |
  { 'Err' : ResolverError };
export type Result_1 = { 'Ok' : EscrowPair } |
  { 'Err' : ResolverError };
export type Result_2 = { 'Ok' : Principal } |
  { 'Err' : ResolverError };
export type Result_3 = { 'Ok' : Array<BidResult> } |
  { 'Err' : ResolverError };
export type Result_4 = { 'Ok' : Array<OneInchOrder> } |
  { 'Err' : ResolverError };
export type Result_5 = { 'Ok' : OneInchQuoteResponse } |
  { 'Err' : ResolverError };
export type Result_6 = { 'Ok' : boolean } |
  { 'Err' : ResolverError };
export interface SettlementData {
  'effective_gas_price' : string,
  'status' : boolean,
  'block_number' : bigint,
  'gas_used' : bigint,
  'tx_hash' : string,
  'gas_price' : string,
}
export interface TransformArgs {
  'context' : Uint8Array | number[],
  'response' : HttpResponse,
}
export interface _SERVICE {
  'complete_atomic_swap' : ActorMethod<[string, Uint8Array | number[]], Result>,
  'create_atomic_escrows' : ActorMethod<[CrossChainOrder], Result_1>,
  'derive_icp_principal' : ActorMethod<[string], Result_2>,
  'evaluate_and_bid_orders' : ActorMethod<[], Result_3>,
  'fetch_orders_from_oneinch' : ActorMethod<[bigint], Result_4>,
  'get_active_orders' : ActorMethod<[], Array<CrossChainOrder>>,
  'get_active_orders_status' : ActorMethod<[], Array<CrossChainOrder>>,
  'get_completed_swaps' : ActorMethod<[], Array<[string, bigint]>>,
  'get_price_quote' : ActorMethod<[string, string, string, bigint], Result_5>,
  'get_resolver_config' : ActorMethod<[], ResolverConfig>,
  'transform_oneinch_response' : ActorMethod<[TransformArgs], HttpResponse>,
  'update_resolver_config' : ActorMethod<[ResolverConfig], Result>,
  'verify_ethereum_settlement' : ActorMethod<[string], Result_6>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
