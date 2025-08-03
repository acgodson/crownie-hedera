export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text });
  return IDL.Service({
    'call_contract' : IDL.Func([IDL.Text, IDL.Text], [Result], []),
    'get_eth_address' : IDL.Func([], [Result], []),
    'send_erc20' : IDL.Func([IDL.Text, IDL.Text, IDL.Nat], [Result], []),
    'send_eth' : IDL.Func([IDL.Text, IDL.Nat], [Result], []),
  });
};
export const init = ({ IDL }) => { return []; };
