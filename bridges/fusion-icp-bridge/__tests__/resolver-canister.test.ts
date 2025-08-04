import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { expect, describe, test, beforeAll } from '@jest/globals';

// Import the generated IDL factory
import { idlFactory } from '../src/declarations/resolver_canister_backend';

describe('Resolver Canister Tests', () => {
  let agent: HttpAgent;
  let resolverActor: any;
  
  const LOCAL_REPLICA_URL = 'http://127.0.0.1:4943';
  const TEST_ETH_ADDRESS = '0x742d35cc6435c7a0c9bb8cb2de6bb7eac81b9e8c';
  const TEST_ICP_PRINCIPAL = 'be2us-64aaa-aaaaa-qaabq-cai';
  const CKETH_MINTER = 'jzenf-aiaaa-aaaar-qaa7q-cai';
  
  beforeAll(async () => {
    // Connect to local replica
    agent = new HttpAgent({ host: LOCAL_REPLICA_URL });
    await agent.fetchRootKey(); // Only for local testing
    
    // Get canister ID from environment or use default
    const resolverCanisterId = process.env.RESOLVER_CANISTER_ID || 'rdmx6-jaaaa-aaaah-qdrna-cai';
    
    resolverActor = Actor.createActor(idlFactory, {
      agent,
      canisterId: resolverCanisterId,
    });
  });

  describe('Configuration Tests', () => {
    test('should get default configuration', async () => {
      const config = await resolverActor.get_config();
      
      expect(config.oneinch_resolver_address).toBe('0x0000000000000000000000000000000000000000');
      expect(config.supported_chains).toEqual([1n, 137n, 56n]); // Ethereum, Polygon, BSC
      expect(config.min_profit_threshold).toBe(1000000000000000n); // 0.001 ETH
    });

    test('should configure for Sepolia testnet', async () => {
      const result = await resolverActor.configure_for_sepolia_testnet();
      expect(result).toEqual({ Ok: null });
      
      const config = await resolverActor.get_config();
      expect(config.oneinch_resolver_address).toBe('0x1111111254eeb25477b68fb85ed929f73a960582');
      expect(config.supported_chains).toEqual([11155111n]); // Sepolia
    });

    test('should set wallet canister', async () => {
      const walletPrincipal = Principal.fromText('be2us-64aaa-aaaaa-qaabq-cai');
      const result = await resolverActor.set_wallet_canister(walletPrincipal);
      expect(result).toEqual({ Ok: null });
    });
  });

  describe('ckETH Integration', () => {
    test('should get deposit address', async () => {
      const result = await resolverActor.deposit_eth_for_cketh(
        TEST_ETH_ADDRESS,
        TEST_ICP_PRINCIPAL,
        BigInt(1000000000000000000) // 1 ETH
      );
      
      expect(result.Ok).toContain('Send');
      expect(result.Ok).toContain('ETH to deposit address');
      expect(result.Ok).toContain(TEST_ICP_PRINCIPAL);
    });
  });

  describe('Cross-Chain Swap Tests', () => {
    test('should initiate EVM to ICP swap', async () => {
      const result = await resolverActor.initiate_evm_to_icp_swap(
        TEST_ETH_ADDRESS,
        TEST_ICP_PRINCIPAL,
        '0x0000000000000000000000000000000000000000', // ETH
        CKETH_MINTER, // ckETH ledger
        BigInt(1000000000000000000), // 1 ETH
        BigInt(3600) // 1 hour timelock
      );
      
      expect(result.Ok).toBeDefined();
      expect(result.Ok.swap_id).toBeDefined();
      expect(result.Ok.source_escrow_address).toBeDefined();
      expect(result.Ok.dest_escrow_address).toBeDefined();
      expect(result.Ok.funding_instructions).toBeDefined();
      
      // Store swap ID for next tests
      global.testSwapId = result.Ok.swap_id;
    });

    test('should get swap details', async () => {
      if (!global.testSwapId) {
        throw new Error('No swap ID from previous test');
      }
      
      const result = await resolverActor.get_swap_details(global.testSwapId);
      
      expect(result.Ok).toBeDefined();
      expect(result.Ok.swap_id).toBe(global.testSwapId);
      expect(result.Ok.user_address).toBe(TEST_ETH_ADDRESS);
      expect(result.Ok.user_icp_principal).toBe(TEST_ICP_PRINCIPAL);
      expect(result.Ok.amount).toBe(BigInt(1000000000000000000));
      expect(result.Ok.status).toEqual({ EscrowsDeployed: null });
    });

    test('should check escrow funding status', async () => {
      if (!global.testSwapId) {
        throw new Error('No swap ID from previous test');
      }
      
      const result = await resolverActor.check_escrow_funding(global.testSwapId);
      
      expect(result.Ok).toBeDefined();
      // Should be NeitherFunded initially since we haven't actually funded
      expect(result.Ok).toEqual({ NeitherFunded: null });
    });

    test('should list active swaps', async () => {
      const swaps = await resolverActor.get_active_swaps();
      
      expect(Array.isArray(swaps)).toBe(true);
      expect(swaps.length).toBeGreaterThan(0);
      
      // Find our test swap
      const ourSwap = swaps.find(([id, _]) => id === global.testSwapId);
      expect(ourSwap).toBeDefined();
    });

    test('should initiate ICP to EVM swap', async () => {
      const result = await resolverActor.initiate_icp_to_evm_swap(
        TEST_ICP_PRINCIPAL,
        TEST_ETH_ADDRESS,
        CKETH_MINTER, // ckETH as source
        '0x0000000000000000000000000000000000000000', // ETH as destination
        BigInt(500000000000000000), // 0.5 ETH
        BigInt(7200) // 2 hour timelock
      );
      
      expect(result.Ok).toBeDefined();
      expect(result.Ok.swap_id).toBeDefined();
      expect(result.Ok.source_escrow_address).toBeDefined();
      expect(result.Ok.dest_escrow_address).toBeDefined();
      
      global.testSwapId2 = result.Ok.swap_id;
    });
  });

  describe('Escrow Management', () => {
    test('should get escrow count', async () => {
      const count = await resolverActor.get_escrow_count();
      expect(typeof count).toBe('bigint');
      expect(count).toBeGreaterThanOrEqual(0n);
    });

    test('should list created ICP escrows', async () => {
      const escrows = await resolverActor.list_created_icp_escrows();
      expect(Array.isArray(escrows)).toBe(true);
      
      // Each escrow should be [swap_id, principal]
      escrows.forEach(([swapId, principal]) => {
        expect(typeof swapId).toBe('string');
        expect(principal instanceof Principal).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent swap', async () => {
      const result = await resolverActor.get_swap_details('non-existent-swap');
      expect(result.Err).toBeDefined();
      expect(result.Err.OrderNotFound).toBeDefined();
    });

    test('should handle invalid principal', async () => {
      try {
        await resolverActor.initiate_evm_to_icp_swap(
          TEST_ETH_ADDRESS,
          'invalid-principal',
          '0x0000000000000000000000000000000000000000',
          CKETH_MINTER,
          BigInt(1000000000000000000),
          BigInt(3600)
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should not refund non-expired swap', async () => {
      if (!global.testSwapId) {
        throw new Error('No swap ID from previous test');
      }
      
      const result = await resolverActor.refund_expired_swap(global.testSwapId);
      expect(result.Err).toBeDefined();
      expect(result.Err.ProcessingError).toContain('not expired yet');
    });
  });

  describe('HTLC Functions', () => {
    test('should get resolver ETH address', async () => {
      const result = await resolverActor.get_resolver_eth_address();
      
      expect(result.Ok).toBeDefined();
      expect(result.Ok).toMatch(/^0x[a-fA-F0-9]{40}$/); // Valid ETH address format
    });
  });
});

// Extend global type for test state
declare global {
  var testSwapId: string;
  var testSwapId2: string;
}