// NO SOLIDITY RESOLVER CONTRACT NEEDED!
//
// The resolver is your ICP canister, not a Solidity contract.
// Your ICP canister calls the 1inch EscrowFactory directly via EVM RPC.
//
// You only need to deploy the 1inch EscrowFactory itself:

pragma solidity 0.8.23;
import "cross-chain-swap/EscrowFactory.sol";

contract TestEscrowFactory is EscrowFactory {
    constructor(
        address limitOrderProtocol,
        IERC20 feeToken,
        IERC20 accessToken,
        address owner,
        uint32 rescueDelaySrc,
        uint32 rescueDelayDst
    ) EscrowFactory(
        limitOrderProtocol, 
        feeToken, 
        accessToken, 
        owner, 
        rescueDelaySrc,  // Fixed: was rescueDelayDst twice
        rescueDelayDst
    ) {}
}

