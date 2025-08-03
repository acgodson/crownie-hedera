// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IEscrowFactory
 * @notice Interface for 1inch EscrowFactory based on their cross-chain resolver example
 */
interface IEscrowFactory {
    /**
     * @notice Deploy source escrow contract
     * @param user Address that will deposit tokens
     * @param token Token contract address
     * @param amount Amount to be escrowed
     * @param secretHash Hash of HTLC secret
     * @param timelock Expiration timestamp
     * @return escrow Address of deployed escrow contract
     */
    function deploySrc(
        address user,
        address token,
        uint256 amount,
        bytes32 secretHash,
        uint256 timelock
    ) external returns (address escrow);
    
    /**
     * @notice Deploy destination escrow contract
     * @param recipient Address that will receive tokens
     * @param token Token contract address
     * @param amount Amount to be escrowed
     * @param secretHash Hash of HTLC secret
     * @param timelock Expiration timestamp
     * @return escrow Address of deployed escrow contract
     */
    function deployDst(
        address recipient,
        address token,
        uint256 amount,
        bytes32 secretHash,
        uint256 timelock
    ) external returns (address escrow);
}

/**
 * @title IEscrow
 * @notice Interface for individual escrow contracts
 */
interface IEscrow {
    /**
     * @notice Withdraw tokens using secret
     * @param secret The preimage that hashes to secretHash
     */
    function withdraw(bytes32 secret) external;
    
    /**
     * @notice Refund tokens after timelock expires
     */
    function refund() external;
    
    /**
     * @notice Get escrow balance
     */
    function getBalance() external view returns (uint256);
    
    /**
     * @notice Get escrow details
     */
    function getDetails() external view returns (
        address user,
        address token,
        uint256 amount,
        bytes32 secretHash,
        uint256 timelock,
        bool withdrawn,
        bool refunded
    );
}