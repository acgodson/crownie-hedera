// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Create2.sol';
import './EscrowMaker.sol';
import './EscrowTaker.sol';

/**
 * @title Resolver - Intent-based DEX Resolver
 * @notice Main interface for users to create and manage token swaps using dual escrows
 * @dev Deploys and manages dual escrow contracts (maker + taker) for each order
 */
contract Resolver is Ownable, ReentrancyGuard {
    struct Order {
        address maker;
        address makerToken;
        uint256 makerAmount;
        address takerToken;
        uint256 takerAmount;
        bytes32 hashLock;
        uint256 timelock;
        uint256 nonce;
        bytes32 salt;
    }

    struct OrderStatus {
        bool exists;
        bool filled;
        bool completed;
        bool cancelled;
        address makerEscrow;
        address takerEscrow;
        address taker;
        uint256 createdAt;
    }

    mapping(bytes32 => OrderStatus) public orders;
    mapping(bytes32 => Order) public orderDetails;
    mapping(address => uint256) public userNonces;

    uint256 public constant MIN_TIMELOCK = 1 hours;
    uint256 public immutable CREATION_FEE;

    event OrderCreated(
        bytes32 indexed orderHash,
        address indexed maker,
        address makerEscrow,
        address takerEscrow,
        Order order
    );

    event OrderFilled(bytes32 indexed orderHash, address indexed taker);

    event SwapCompleted(bytes32 indexed orderHash, bytes32 secret);

    event OrderCancelled(bytes32 indexed orderHash);

    error OrderAlreadyExists();
    error OrderNotFound();
    error OrderAlreadyFilled();
    error OrderNotFilled();
    error OrderAlreadyCompleted();
    error OrderAlreadyCancelled();
    error InvalidTimelock();
    error UnauthorizedCaller();
    error InsufficientFee();
    error InvalidParameters();

    constructor(address initialOwner, uint256 creationFee) Ownable(initialOwner) {
        CREATION_FEE = creationFee;
    }

    function createOrder(
        Order calldata order
    ) external payable nonReentrant returns (bytes32 orderHash, address makerEscrow, address takerEscrow) {
        if (msg.value < CREATION_FEE) revert InsufficientFee();
        if (order.maker != msg.sender) revert UnauthorizedCaller();
        if (order.timelock < block.timestamp + MIN_TIMELOCK) revert InvalidTimelock();
        if (order.makerAmount == 0 || order.takerAmount == 0) revert InvalidParameters();
        if (order.makerToken == order.takerToken) revert InvalidParameters();

        orderHash = _generateOrderHash(order);

        if (orders[orderHash].exists) revert OrderAlreadyExists();

        (makerEscrow, takerEscrow) = _deployDualEscrows(orderHash, order.salt);

        EscrowMaker(makerEscrow).initialize(
            orderHash,
            order.maker,
            order.makerToken,
            order.makerAmount,
            order.hashLock,
            order.timelock
        );

        orders[orderHash] = OrderStatus({
            exists: true,
            filled: false,
            completed: false,
            cancelled: false,
            makerEscrow: makerEscrow,
            takerEscrow: takerEscrow,
            taker: address(0),
            createdAt: block.timestamp
        });

        orderDetails[orderHash] = order;

        userNonces[msg.sender]++;

        emit OrderCreated(orderHash, order.maker, makerEscrow, takerEscrow, order);
    }

    function fillOrder(bytes32 orderHash, Order calldata order) external nonReentrant {
        OrderStatus storage orderStatus = orders[orderHash];

        if (!orderStatus.exists) revert OrderNotFound();
        if (orderStatus.filled) revert OrderAlreadyFilled();
        if (orderStatus.cancelled) revert OrderAlreadyCancelled();
        if (block.timestamp >= order.timelock) revert InvalidTimelock();

        bytes32 computedHash = _generateOrderHash(order);
        if (computedHash != orderHash) revert InvalidParameters();

        orderStatus.taker = msg.sender;
        orderStatus.filled = true;

        EscrowMaker(orderStatus.makerEscrow).setTaker(msg.sender);

        EscrowTaker(orderStatus.takerEscrow).initialize(
            orderHash,
            msg.sender,
            order.takerToken,
            order.takerAmount,
            order.hashLock,
            order.timelock,
            order.maker
        );

        emit OrderFilled(orderHash, msg.sender);
    }

    function completeSwap(bytes32 orderHash, bytes32 secret) external nonReentrant {
        OrderStatus storage orderStatus = orders[orderHash];

        if (!orderStatus.exists) revert OrderNotFound();
        if (!orderStatus.filled) revert OrderNotFilled();
        if (orderStatus.completed) revert OrderAlreadyCompleted();
        if (orderStatus.cancelled) revert OrderAlreadyCancelled();

        orderStatus.completed = true;

        EscrowTaker(orderStatus.takerEscrow).claimTokens(secret);
        EscrowMaker(orderStatus.makerEscrow).claimTokens(secret);

        emit SwapCompleted(orderHash, secret);
    }

    function cancelOrder(bytes32 orderHash, Order calldata order) external nonReentrant {
        OrderStatus storage orderStatus = orders[orderHash];

        if (!orderStatus.exists) revert OrderNotFound();
        if (orderStatus.completed) revert OrderAlreadyCompleted();
        if (orderStatus.cancelled) revert OrderAlreadyCancelled();
        if (order.maker != msg.sender) revert UnauthorizedCaller();
        if (block.timestamp < order.timelock) revert InvalidTimelock();

        bytes32 computedHash = _generateOrderHash(order);
        if (computedHash != orderHash) revert InvalidParameters();

        orderStatus.cancelled = true;

        EscrowMaker(orderStatus.makerEscrow).cancel();

        if (orderStatus.filled) {
            EscrowTaker(orderStatus.takerEscrow).refund();
        }

        emit OrderCancelled(orderHash);
    }

    function getOrderStatus(bytes32 orderHash) external view returns (OrderStatus memory status) {
        return orders[orderHash];
    }

    function getOrder(bytes32 orderHash) external view returns (Order memory order) {
        if (!orders[orderHash].exists) revert OrderNotFound();
        return orderDetails[orderHash];
    }

    function computeEscrowAddresses(
        bytes32 orderHash,
        bytes32 salt
    ) external view returns (address makerEscrow, address takerEscrow) {
        bytes32 makerBytecodeHash = keccak256(type(EscrowMaker).creationCode);
        bytes32 takerBytecodeHash = keccak256(type(EscrowTaker).creationCode);
        bytes32 makerSalt = keccak256(abi.encodePacked(orderHash, salt, 'maker'));
        bytes32 takerSalt = keccak256(abi.encodePacked(orderHash, salt, 'taker'));

        makerEscrow = Create2.computeAddress(makerSalt, makerBytecodeHash);
        takerEscrow = Create2.computeAddress(takerSalt, takerBytecodeHash);
    }

    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(owner()).transfer(balance);
        }
    }

    function _generateOrderHash(Order calldata order) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    order.maker,
                    order.makerToken,
                    order.makerAmount,
                    order.takerToken,
                    order.takerAmount,
                    order.hashLock,
                    order.timelock,
                    order.nonce,
                    order.salt
                )
            );
    }

    function _deployDualEscrows(
        bytes32 orderHash,
        bytes32 salt
    ) internal returns (address makerEscrow, address takerEscrow) {
        bytes32 makerSalt = keccak256(abi.encodePacked(orderHash, salt, 'maker'));
        bytes32 takerSalt = keccak256(abi.encodePacked(orderHash, salt, 'taker'));

        makerEscrow = address(new EscrowMaker{salt: makerSalt}());
        takerEscrow = address(new EscrowTaker{salt: takerSalt}());
    }
}
