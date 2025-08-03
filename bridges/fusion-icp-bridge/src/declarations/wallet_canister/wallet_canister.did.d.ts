import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type Result = { 'Ok' : string } |
  { 'Err' : string };
export interface _SERVICE {
  'call_contract' : ActorMethod<[string, string], Result>,
  'get_eth_address' : ActorMethod<[], Result>,
  'send_erc20' : ActorMethod<[string, string, bigint], Result>,
  'send_eth' : ActorMethod<[string, bigint], Result>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
