export const idlFactory = ({ IDL }) => {
  const IcpEscrowParams = IDL.Record({
    'depositor' : IDL.Principal,
    'resolver' : IDL.Principal,
    'recipient' : IDL.Principal,
    'secret_hash' : IDL.Vec(IDL.Nat8),
    'amount' : IDL.Nat,
    'token_ledger' : IDL.Principal,
    'timelock' : IDL.Nat64,
  });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text });
  const IcpEscrowStatus = IDL.Variant({
    'Refunded' : IDL.Null,
    'Released' : IDL.Null,
    'Funded' : IDL.Null,
    'Created' : IDL.Null,
    'Expired' : IDL.Null,
  });
  return IDL.Service({
    'deposit_tokens' : IDL.Func([IDL.Nat], [Result_1], []),
    'get_account_identifier' : IDL.Func([], [IDL.Text], ['query']),
    'get_balance' : IDL.Func([], [IDL.Nat], ['query']),
    'get_params' : IDL.Func([], [IDL.Opt(IcpEscrowParams)], ['query']),
    'get_status' : IDL.Func([], [IcpEscrowStatus], ['query']),
    'is_funded' : IDL.Func([], [IDL.Bool], ['query']),
    'refund_expired' : IDL.Func([], [Result_1], []),
    'release_with_secret' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result_1], []),
  });
};
export const init = ({ IDL }) => {
  const IcpEscrowParams = IDL.Record({
    'depositor' : IDL.Principal,
    'resolver' : IDL.Principal,
    'recipient' : IDL.Principal,
    'secret_hash' : IDL.Vec(IDL.Nat8),
    'amount' : IDL.Nat,
    'token_ledger' : IDL.Principal,
    'timelock' : IDL.Nat64,
  });
  return [IcpEscrowParams];
};
