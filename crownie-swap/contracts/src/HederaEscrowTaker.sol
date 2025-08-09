// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import 'hedera-token-service/HederaTokenService.sol';

contract HederaEscrowTaker is ReentrancyGuard, HederaTokenService {
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
    event ResponseCode(int responseCode);

    error UnauthorizedCaller();
    error OrderExpired();
    error OrderNotExpired();
    error InvalidSecret();
    error AlreadyDeposited();
    error OrderAlreadyCompleted();
    error OrderAlreadyCancelled();
    error OrderNotInitialized();
    error HederaTokenServiceFailed(int responseCode);

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

        int responseCode = HederaTokenService.transferToken(token, taker, address(this), int64(int(amount)));
        _handleHederaResponse(responseCode);

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

        int responseCode = HederaTokenService.transferToken(
            orderData.token,
            address(this),
            orderData.maker,
            int64(int(orderData.amount))
        );
        _handleHederaResponse(responseCode);

        emit TokensClaimed(orderHash, orderData.maker, secret);
    }

    function refund() external onlyTaker nonReentrant {
        if (orderData.taker == address(0)) revert OrderNotInitialized();
        if (orderData.completed) revert OrderAlreadyCompleted();
        if (orderData.cancelled) revert OrderAlreadyCancelled();
        if (block.timestamp < orderData.timelock) revert OrderNotExpired();

        orderData.cancelled = true;

        int responseCode = HederaTokenService.transferToken(
            orderData.token,
            address(this),
            orderData.taker,
            int64(int(orderData.amount))
        );
        _handleHederaResponse(responseCode);

        emit TakerRefunded(orderHash);
    }

    function getOrderData() external view returns (OrderData memory) {
        return orderData;
    }

    function _handleHederaResponse(int responseCode) internal {
        emit ResponseCode(responseCode);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert HederaTokenServiceFailed(responseCode);
        }
    }
}
