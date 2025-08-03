// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IEscrowFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ICPBridgeFactory
 * @notice Wrapper contract for ICP resolver to deploy 1inch-style escrows
 * @dev This contract interfaces with 1inch EscrowFactory to create cross-chain swaps
 */
contract ICPBridgeFactory is ReentrancyGuard {
    IEscrowFactory public immutable oneinchFactory;
    address public immutable icpResolver; // ICP canister via threshold ECDSA
    
    // WICP token address for ICP representation
    address public immutable wicpToken;
    
    event SourceEscrowDeployed(
        address indexed escrow,
        address indexed user,
        address indexed token,
        uint256 amount,
        bytes32 secretHash
    );
    
    event DestEscrowDeployed(
        address indexed escrow,
        address indexed recipient,
        address indexed token,
        uint256 amount,
        bytes32 secretHash
    );
    
    modifier onlyICPResolver() {
        require(msg.sender == icpResolver, "Only ICP resolver can call");
        _;
    }
    
    constructor(
        address _oneinchFactory,
        address _icpResolver,
        address _wicpToken
    ) {
        oneinchFactory = IEscrowFactory(_oneinchFactory);
        icpResolver = _icpResolver;
        wicpToken = _wicpToken;
    }
    
    /**
     * @notice Deploy source escrow (user deposits tokens)
     * @param user Address that will deposit tokens
     * @param token Token contract address
     * @param amount Amount to be escrowed
     * @param secretHash Hash of HTLC secret
     * @param timelock Expiration timestamp
     * @return escrow Address of deployed escrow contract
     */
    function deploySourceEscrow(
        address user,
        address token,
        uint256 amount,
        bytes32 secretHash,
        uint256 timelock
    ) external onlyICPResolver nonReentrant returns (address escrow) {
        // Deploy source escrow using 1inch factory
        escrow = oneinchFactory.deploySrc(
            user,
            token,
            amount,
            secretHash,
            timelock
        );
        
        emit SourceEscrowDeployed(escrow, user, token, amount, secretHash);
    }
    
    /**
     * @notice Deploy destination escrow (resolver funds with WICP)
     * @param recipient Address that will receive tokens
     * @param token Token contract address (should be WICP for ICP swaps)
     * @param amount Amount to be escrowed
     * @param secretHash Hash of HTLC secret
     * @param timelock Expiration timestamp
     * @return escrow Address of deployed escrow contract
     */
    function deployDestEscrow(
        address recipient,
        address token,
        uint256 amount,
        bytes32 secretHash,
        uint256 timelock
    ) external onlyICPResolver nonReentrant returns (address escrow) {
        // For ICP swaps, token should be WICP
        require(token == wicpToken, "Dest escrow must use WICP token");
        
        // Transfer WICP from resolver to this contract first
        IERC20(wicpToken).transferFrom(icpResolver, address(this), amount);
        
        // Deploy destination escrow using 1inch factory
        escrow = oneinchFactory.deployDst(
            recipient,
            token,
            amount,
            secretHash,
            timelock
        );
        
        // Fund the escrow with WICP
        IERC20(wicpToken).transfer(escrow, amount);
        
        emit DestEscrowDeployed(escrow, recipient, token, amount, secretHash);
    }
    
    /**
     * @notice Emergency function to withdraw stuck tokens
     * @dev Only callable by ICP resolver
     */
    function emergencyWithdraw(address token, uint256 amount) 
        external 
        onlyICPResolver 
    {
        IERC20(token).transfer(icpResolver, amount);
    }
    
    /**
     * @notice Get WICP token address
     */
    function getWICPToken() external view returns (address) {
        return wicpToken;
    }
    
    /**
     * @notice Get 1inch factory address
     */
    function getOneinchFactory() external view returns (address) {
        return address(oneinchFactory);
    }
}