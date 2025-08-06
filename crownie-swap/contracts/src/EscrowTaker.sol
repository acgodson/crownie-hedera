// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

/**
 * @title EscrowTaker - Taker side escrow for intent-based DEX
 * @notice Holds taker's tokens with hash-time lock mechanism
 * @dev Deployed by Resolver for each order's taker side
 */
contract EscrowTaker is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct OrderData {
        address taker;
        address token;
        uint256 amount;
        bytes32 hashLock;
        uint256 timelock;
        bool deposited;
        bool completed;
        bool cancelled;
        address maker;
    }

    OrderData public orderData;
    address public immutable resolver;
    bytes32 public orderHash;

    uint256 public constant TAKER_TIMELOCK_BUFFER = 30 minutes;

    event TakerDeposited(bytes32 indexed orderHash, uint256 amount);
    event TokensClaimed(bytes32 indexed orderHash, address indexed maker, bytes32 secret);
    event TakerRefunded(bytes32 indexed orderHash);

    error UnauthorizedCaller();
    error OrderExpired();
    error OrderNotExpired();
    error InvalidSecret();
    error AlreadyDeposited();
    error OrderAlreadyCompleted();
    error OrderAlreadyCancelled();
    error OrderNotInitialized();

    modifier onlyResolver() {
        if (msg.sender != resolver) revert UnauthorizedCaller();
        _;
    }

    modifier onlyMaker() {
        if (msg.sender != orderData.maker) revert UnauthorizedCaller();
        _;
    }

    modifier onlyTaker() {
        if (msg.sender != orderData.taker) revert UnauthorizedCaller();
        _;
    }

    constructor() {
        resolver = msg.sender;
    }

    function initialize(
        bytes32 _orderHash,
        address taker,
        address token,
        uint256 amount,
        bytes32 hashLock,
        uint256 timelock,
        address maker
    ) external onlyResolver {
        if (orderData.taker != address(0)) revert OrderAlreadyCompleted();

        orderHash = _orderHash;
        orderData = OrderData({
            taker: taker,
            token: token,
            amount: amount,
            hashLock: hashLock,
            timelock: timelock - TAKER_TIMELOCK_BUFFER,
            deposited: false,
            completed: false,
            cancelled: false,
            maker: maker
        });

        IERC20(token).safeTransferFrom(taker, address(this), amount);
        orderData.deposited = true;

        emit TakerDeposited(_orderHash, amount);
    }

    function claimTokens(bytes32 secret) external nonReentrant {
        if (msg.sender != orderData.maker && msg.sender != resolver) revert UnauthorizedCaller();
        if (orderData.taker == address(0)) revert OrderNotInitialized();
        if (orderData.completed) revert OrderAlreadyCompleted();
        if (orderData.cancelled) revert OrderAlreadyCancelled();
        if (keccak256(abi.encodePacked(secret)) != orderData.hashLock) revert InvalidSecret();
        if (block.timestamp >= orderData.timelock) revert OrderExpired();

        orderData.completed = true;
        IERC20(orderData.token).safeTransfer(orderData.maker, orderData.amount);

        emit TokensClaimed(orderHash, orderData.maker, secret);
    }

    function refund() external onlyTaker nonReentrant {
        if (orderData.taker == address(0)) revert OrderNotInitialized();
        if (orderData.completed) revert OrderAlreadyCompleted();
        if (orderData.cancelled) revert OrderAlreadyCancelled();
        if (block.timestamp < orderData.timelock) revert OrderNotExpired();

        orderData.cancelled = true;
        IERC20(orderData.token).safeTransfer(orderData.taker, orderData.amount);

        emit TakerRefunded(orderHash);
    }

    function getOrderData() external view returns (OrderData memory) {
        return orderData;
    }
}
