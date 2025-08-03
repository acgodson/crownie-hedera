import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

// TypeScript test for cross-chain ckETH functionality
describe('Cross-Chain ckETH Bridge Tests', () => {
  let agent: HttpAgent;
  let resolverActor: any;
  
  // Sepolia testnet configuration
  const SEPOLIA_CKETH_MINTER = 'jzenf-aiaaa-aaaar-qaa7q-cai';
  const LOCAL_REPLICA_URL = 'http://127.0.0.1:4943';
  
  beforeAll(async () => {
    // Connect to local replica
    agent = new HttpAgent({ host: LOCAL_REPLICA_URL });
    await agent.fetchRootKey(); // Only for local testing
    
    // Create resolver actor (need to get canister ID from dfx)
    const resolverCanisterId = process.env.RESOLVER_CANISTER_ID || 'u6s2n-gx777-77774-qaaba-cai';
    
    // Import generated Candid interface
    const { idlFactory } = await import('../src/resolver_canister_backend/resolver_canister_backend.did.js');
    
    resolverActor = Actor.createActor(idlFactory, {
      agent,
      canisterId: resolverCanisterId,
    });
  });

  describe('ckETH Integration Tests', () => {
    test('should configure for Sepolia testnet', async () => {
      const result = await resolverActor.configure_for_sepolia_testnet();
      expect(result).toEqual({ Ok: null });
    });

    test('should get deposit address for ETH to ckETH conversion', async () => {
      const userEthAddress = '0x742d35cc6435c7a0c9bb8cb2de6bb7eac81b9e8c'; // Test address
      const userIcpPrincipal = Principal.fromText('rdmx6-jaaaa-aaaah-qdrna-cai').toString();
      const amount = BigInt(1000000000000000000); // 1 ETH in wei
      
      const result = await resolverActor.deposit_eth_for_cketh(
        userEthAddress,
        userIcpPrincipal, 
        amount
      );
      
      console.log('Deposit result:', result);
      expect(result.Ok).toContain('Send');
      expect(result.Ok).toContain('ETH to deposit address');
    });

    test('should initiate ETH to ICP swap', async () => {
      const userEthAddress = '0x742d35cc6435c7a0c9bb8cb2de6bb7eac81b9e8c';
      const userIcpPrincipal = Principal.fromText('rdmx6-jaaaa-aaaah-qdrna-cai').toString();
      const sourceToken = '0x0000000000000000000000000000000000000000'; // ETH
      const destToken = SEPOLIA_CKETH_MINTER; // ckETH ledger
      const amount = BigInt(1000000000000000000); // 1 ETH
      const timelockDuration = BigInt(3600); // 1 hour
      
      const result = await resolverActor.initiate_evm_to_icp_swap(
        userEthAddress,
        userIcpPrincipal,
        sourceToken,
        destToken,
        amount,
        timelockDuration
      );
      
      console.log('Swap initiation result:', result);
      expect(result.Ok).toBeDefined();
      expect(result.Ok.swap_id).toBeDefined();
      expect(result.Ok.funding_instructions).toBeDefined();
    });

    test('should check escrow funding status', async () => {
      // First create a swap
      const userEthAddress = '0x742d35cc6435c7a0c9bb8cb2de6bb7eac81b9e8c';
      const userIcpPrincipal = Principal.fromText('rdmx6-jaaaa-aaaah-qdrna-cai').toString();
      const sourceToken = '0x0000000000000000000000000000000000000000';
      const destToken = SEPOLIA_CKETH_MINTER;
      const amount = BigInt(1000000000000000000);
      const timelockDuration = BigInt(3600);
      
      const swapResult = await resolverActor.initiate_evm_to_icp_swap(
        userEthAddress,
        userIcpPrincipal,
        sourceToken,
        destToken,
        amount,
        timelockDuration
      );
      
      expect(swapResult.Ok).toBeDefined();
      const swapId = swapResult.Ok.swap_id;
      
      // Check funding status
      const fundingResult = await resolverActor.check_escrow_funding(swapId);
      console.log('Funding status:', fundingResult);
      
      // Should be NeitherFunded initially
      expect(fundingResult.Ok).toBeDefined();
    });

    test('should get created ICP escrow count', async () => {
      const result = await resolverActor.get_escrow_count();
      console.log('Escrow count:', result);
      expect(typeof result).toBe('bigint');
    });

    test('should list created ICP escrows', async () => {
      const result = await resolverActor.list_created_icp_escrows();
      console.log('Created escrows:', result);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Real Cross-Chain Flow Simulation', () => {
    test('should simulate complete ETH to ckETH flow', async () => {
      console.log('=== Simulating ETH to ckETH Cross-Chain Transfer ===');
      
      const userEthAddress = process.env.TEST_ETH_ADDRESS || '0x742d35cc6435c7a0c9bb8cb2de6bb7eac81b9e8c';
      const userIcpPrincipal = Principal.fromText('rdmx6-jaaaa-aaaah-qdrna-cai').toString();
      
      // Step 1: Get deposit address for real ckETH conversion
      console.log('Step 1: Getting ckETH deposit address...');
      const depositResult = await resolverActor.deposit_eth_for_cketh(
        userEthAddress,
        userIcpPrincipal,
        BigInt(100000000000000000) // 0.1 ETH
      );
      
      console.log('Deposit instructions:', depositResult.Ok);
      
      // Step 2: Initiate bridge swap
      console.log('Step 2: Initiating bridge swap...');
      const swapResult = await resolverActor.initiate_evm_to_icp_swap(
        userEthAddress,
        userIcpPrincipal,
        '0x0000000000000000000000000000000000000000', // ETH
        SEPOLIA_CKETH_MINTER, // ckETH
        BigInt(100000000000000000), // 0.1 ETH
        BigInt(7200) // 2 hours
      );
      
      console.log('Swap details:', swapResult.Ok);
      
      // Step 3: Check status
      console.log('Step 3: Checking swap status...');
      const statusResult = await resolverActor.get_swap_details(swapResult.Ok.swap_id);
      console.log('Swap status:', statusResult.Ok);
      
      expect(swapResult.Ok.swap_id).toBeDefined();
      expect(swapResult.Ok.source_escrow_address).toBeDefined();
      expect(swapResult.Ok.dest_escrow_address).toBeDefined();
    });
  });
});