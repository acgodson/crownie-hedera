export const idlFactory = ({ IDL }) => {
  const ResolverError = IDL.Variant({
    'InvalidInput' : IDL.Text,
    'NetworkError' : IDL.Text,
    'ContractError' : IDL.Text,
    'OrderNotFound' : IDL.Text,
    'ProcessingError' : IDL.Text,
    'InsufficientCycles' : IDL.Text,
    'InsufficientLiquidity' : IDL.Text,
    'ExternalCallError' : IDL.Text,
    'SlippageExceeded' : IDL.Text,
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : ResolverError });
  const AuctionDetails = IDL.Record({
    'duration' : IDL.Nat64,
    'start_time' : IDL.Nat64,
    'initial_rate_bump' : IDL.Nat32,
    'gas_price' : IDL.Nat64,
  });
  const CrossChainOrder = IDL.Record({
    'maker' : IDL.Text,
    'src_chain_id' : IDL.Nat64,
    'time_lock' : IDL.Nat64,
    'maker_asset' : IDL.Text,
    'taking_amount' : IDL.Nat,
    'making_amount' : IDL.Nat,
    'dst_chain_id' : IDL.Nat64,
    'hash_lock' : IDL.Vec(IDL.Nat8),
    'order_hash' : IDL.Text,
    'taker_asset' : IDL.Text,
    'auction_details' : AuctionDetails,
  });
  const EscrowPair = IDL.Record({
    'ethereum_escrow' : IDL.Text,
    'icp_escrow' : IDL.Text,
  });
  const Result_1 = IDL.Variant({ 'Ok' : EscrowPair, 'Err' : ResolverError });
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Principal, 'Err' : ResolverError });
  const BidResult = IDL.Record({
    'bid_accepted' : IDL.Bool,
    'order_hash' : IDL.Text,
    'profitability_score' : IDL.Float64,
    'estimated_profit' : IDL.Nat,
  });
  const Result_3 = IDL.Variant({
    'Ok' : IDL.Vec(BidResult),
    'Err' : ResolverError,
  });
  const OrderStatus = IDL.Record({
    'status' : IDL.Text,
    'cancelled_at' : IDL.Opt(IDL.Nat64),
    'filled_at' : IDL.Opt(IDL.Nat64),
    'remaining_making_amount' : IDL.Text,
    'expires_at' : IDL.Nat64,
  });
  const AuctionPoint = IDL.Record({
    'coefficient' : IDL.Nat32,
    'delay' : IDL.Nat64,
  });
  const SettlementData = IDL.Record({
    'effective_gas_price' : IDL.Text,
    'status' : IDL.Bool,
    'block_number' : IDL.Nat64,
    'gas_used' : IDL.Nat64,
    'tx_hash' : IDL.Text,
    'gas_price' : IDL.Text,
  });
  const OneInchOrder = IDL.Record({
    'maker' : IDL.Text,
    'auction_start_date' : IDL.Nat64,
    'status' : IDL.Opt(OrderStatus),
    'maker_asset' : IDL.Text,
    'taking_amount' : IDL.Text,
    'creation_timestamp' : IDL.Nat64,
    'making_amount' : IDL.Text,
    'hash' : IDL.Text,
    'auction_duration' : IDL.Nat64,
    'salt' : IDL.Text,
    'maker_traits' : IDL.Text,
    'taker_asset' : IDL.Text,
    'initial_rate_bump' : IDL.Nat32,
    'receiver' : IDL.Text,
    'points' : IDL.Vec(AuctionPoint),
    'settlement' : IDL.Opt(SettlementData),
  });
  const Result_4 = IDL.Variant({
    'Ok' : IDL.Vec(OneInchOrder),
    'Err' : ResolverError,
  });
  const QuoteSource = IDL.Record({
    'name' : IDL.Text,
    'proportion' : IDL.Text,
  });
  const OneInchQuoteResponse = IDL.Record({
    'dst_amount' : IDL.Text,
    'guaranteed_price' : IDL.Opt(IDL.Text),
    'price_impact' : IDL.Opt(IDL.Float64),
    'sources' : IDL.Opt(IDL.Vec(QuoteSource)),
    'estimated_gas' : IDL.Nat64,
    'gas_price' : IDL.Text,
  });
  const Result_5 = IDL.Variant({
    'Ok' : OneInchQuoteResponse,
    'Err' : ResolverError,
  });
  const ChainConfig = IDL.Record({
    'explorer_url' : IDL.Text,
    'block_time' : IDL.Nat64,
    'native_currency' : IDL.Text,
    'chain_id' : IDL.Nat64,
    'rpc_url' : IDL.Text,
  });
  const BridgeConfig = IDL.Record({
    'source_chain' : ChainConfig,
    'max_gas_limit' : IDL.Nat64,
    'destination_chain' : ChainConfig,
    'bridge_contract' : IDL.Text,
    'min_confirmation_blocks' : IDL.Nat64,
  });
  const ResolverConfig = IDL.Record({
    'custom_rpc_url' : IDL.Opt(IDL.Text),
    'alchemy_api_key' : IDL.Opt(IDL.Text),
    'max_gas_price' : IDL.Nat64,
    'bridge_config' : IDL.Opt(BridgeConfig),
    'oneinch_api_key' : IDL.Opt(IDL.Text),
    'min_profit_threshold' : IDL.Nat,
    'supported_tokens' : IDL.Vec(IDL.Text),
    'evm_rpc_canister' : IDL.Principal,
  });
  const HttpHeader = IDL.Record({ 'value' : IDL.Text, 'name' : IDL.Text });
  const HttpResponse = IDL.Record({
    'status' : IDL.Nat,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(HttpHeader),
  });
  const TransformArgs = IDL.Record({
    'context' : IDL.Vec(IDL.Nat8),
    'response' : HttpResponse,
  });
  const Result_6 = IDL.Variant({ 'Ok' : IDL.Bool, 'Err' : ResolverError });
  return IDL.Service({
    'complete_atomic_swap' : IDL.Func(
        [IDL.Text, IDL.Vec(IDL.Nat8)],
        [Result],
        [],
      ),
    'create_atomic_escrows' : IDL.Func([CrossChainOrder], [Result_1], []),
    'derive_icp_principal' : IDL.Func([IDL.Text], [Result_2], []),
    'evaluate_and_bid_orders' : IDL.Func([], [Result_3], []),
    'fetch_orders_from_oneinch' : IDL.Func([IDL.Nat64], [Result_4], []),
    'get_active_orders' : IDL.Func([], [IDL.Vec(CrossChainOrder)], ['query']),
    'get_active_orders_status' : IDL.Func(
        [],
        [IDL.Vec(CrossChainOrder)],
        ['query'],
      ),
    'get_completed_swaps' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat64))],
        ['query'],
      ),
    'get_price_quote' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, IDL.Nat64],
        [Result_5],
        [],
      ),
    'get_resolver_config' : IDL.Func([], [ResolverConfig], ['query']),
    'transform_oneinch_response' : IDL.Func(
        [TransformArgs],
        [HttpResponse],
        ['query'],
      ),
    'update_resolver_config' : IDL.Func([ResolverConfig], [Result], []),
    'verify_ethereum_settlement' : IDL.Func([IDL.Text], [Result_6], []),
  });
};
export const init = ({ IDL }) => { return []; };
