import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface IcpEscrowParams {
  'depositor' : Principal,
  'resolver' : Principal,
  'recipient' : Principal,
  'secret_hash' : Uint8Array | number[],
  'amount' : bigint,
  'token_ledger' : Principal,
  'timelock' : bigint,
}
export type IcpEscrowStatus = { 'Refunded' : null } |
  { 'Released' : null } |
  { 'Funded' : null } |
  { 'Created' : null } |
  { 'Expired' : null };
export type Result_1 = { 'Ok' : string } |
  { 'Err' : string };
export interface _SERVICE {
  'deposit_tokens' : ActorMethod<[bigint], Result_1>,
  'get_account_identifier' : ActorMethod<[], string>,
  'get_balance' : ActorMethod<[], bigint>,
  'get_params' : ActorMethod<[], [] | [IcpEscrowParams]>,
  'get_status' : ActorMethod<[], IcpEscrowStatus>,
  'is_funded' : ActorMethod<[], boolean>,
  'refund_expired' : ActorMethod<[], Result_1>,
  'release_with_secret' : ActorMethod<[Uint8Array | number[]], Result_1>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
