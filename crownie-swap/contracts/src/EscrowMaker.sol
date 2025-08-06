// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

/**
 * @title EscrowMaker - Maker side escrow for intent-based DEX
 * @notice Holds maker's tokens with hash-time lock mechanism
 * @dev Deployed by Resolver for each order's maker side
 */
contract EscrowMaker is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct OrderData {
        address maker;
        address token;
        uint256 amount;
        bytes32 hashLock;
        uint256 timelock;
        bool deposited;
        bool completed;
        bool cancelled;
        address taker;
    }

    OrderData public orderData;
    address public immutable resolver;
    bytes32 public orderHash;

    event MakerDeposited(bytes32 indexed orderHash, uint256 amount);
    event TokensClaimed(bytes32 indexed orderHash, address indexed taker, bytes32 secret);
    event OrderCancelled(bytes32 indexed orderHash);

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
        address maker,
        address token,
        uint256 amount,
        bytes32 hashLock,
        uint256 timelock
    ) external onlyResolver {
        if (orderData.maker != address(0)) revert OrderAlreadyCompleted();

        orderHash = _orderHash;
        orderData = OrderData({
            maker: maker,
            token: token,
            amount: amount,
            hashLock: hashLock,
            timelock: timelock,
            deposited: false,
            completed: false,
            cancelled: false,
            taker: address(0)
        });

        IERC20(token).safeTransferFrom(maker, address(this), amount);
        orderData.deposited = true;

        emit MakerDeposited(_orderHash, amount);
    }

    function setTaker(address taker) external onlyResolver {
        orderData.taker = taker;
    }

    function claimTokens(bytes32 secret) external nonReentrant {
        if (msg.sender != orderData.taker && msg.sender != resolver) revert UnauthorizedCaller();
        if (orderData.maker == address(0)) revert OrderNotInitialized();
        if (orderData.completed) revert OrderAlreadyCompleted();
        if (orderData.cancelled) revert OrderAlreadyCancelled();
        if (keccak256(abi.encodePacked(secret)) != orderData.hashLock) revert InvalidSecret();
        if (block.timestamp >= orderData.timelock) revert OrderExpired();

        orderData.completed = true;
        IERC20(orderData.token).safeTransfer(orderData.taker, orderData.amount);

        emit TokensClaimed(orderHash, orderData.taker, secret);
    }

    function cancel() external onlyMaker nonReentrant {
        if (orderData.maker == address(0)) revert OrderNotInitialized();
        if (orderData.completed) revert OrderAlreadyCompleted();
        if (orderData.cancelled) revert OrderAlreadyCancelled();
        if (block.timestamp < orderData.timelock) revert OrderNotExpired();

        orderData.cancelled = true;
        IERC20(orderData.token).safeTransfer(orderData.maker, orderData.amount);

        emit OrderCancelled(orderHash);
    }

    function getOrderData() external view returns (OrderData memory) {
        return orderData;
    }
}
