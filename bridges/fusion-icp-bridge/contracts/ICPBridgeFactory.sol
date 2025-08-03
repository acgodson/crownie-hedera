// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


contract ICPBridgeFactory {
    address public immutable icpResolver;
    uint256 public escrowCount;
    
    mapping(bytes32 => address) public escrows;
    
    event EscrowDeployed(
        bytes32 indexed escrowId,
        address indexed escrow,
        address indexed depositor,
        address recipient,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    );
    
    modifier onlyICPResolver() {
        require(msg.sender == icpResolver, "Only ICP resolver can call");
        _;
    }
    
    constructor(address _icpResolver) {
        icpResolver = _icpResolver;
    }
    
    function deployEscrow(
        address depositor,
        address recipient,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    ) external onlyICPResolver returns (bytes32 escrowId, address escrow) {
        escrowId = keccak256(abi.encodePacked(depositor, recipient, amount, hashlock, timelock, escrowCount));
        
        // Deploy simple HTLC escrow
        escrow = address(new SimpleHTLC(depositor, recipient, amount, hashlock, timelock));
        escrows[escrowId] = escrow;
        escrowCount++;
        
        emit EscrowDeployed(escrowId, escrow, depositor, recipient, amount, hashlock, timelock);
    }
    
    function getEscrow(bytes32 escrowId) external view returns (address) {
        return escrows[escrowId];
    }
}

contract SimpleHTLC {
    uint256 public amount;
    bytes32 public hashlock;
    uint256 public timelock;
    address public depositor;
    address public recipient;
    bool public withdrawn;
    bool public refunded;
    
    event Deposited(address indexed depositor, uint256 amount);
    event Withdrawn(address indexed recipient, bytes32 preimage);
    event Refunded(address indexed depositor);
    
    constructor(
        address _depositor,
        address _recipient,
        uint256 _amount,
        bytes32 _hashlock,
        uint256 _timelock
    ) {
        depositor = _depositor;
        recipient = _recipient;
        amount = _amount;
        hashlock = _hashlock;
        timelock = _timelock;
    }
    
    function deposit() external payable {
        require(msg.sender == depositor, "Only depositor");
        require(msg.value == amount, "Wrong amount");
        require(!withdrawn && !refunded, "Already completed");
        
        emit Deposited(msg.sender, msg.value);
    }
    
    function withdraw(bytes32 preimage) external {
        require(msg.sender == recipient, "Only recipient");
        require(!withdrawn && !refunded, "Already completed");
        require(sha256(abi.encodePacked(preimage)) == hashlock, "Invalid preimage");
        require(block.timestamp < timelock, "Expired");
        require(address(this).balance >= amount, "Not funded");
        
        withdrawn = true;
        payable(recipient).transfer(amount);
        
        emit Withdrawn(recipient, preimage);
    }
    
    function refund() external {
        require(msg.sender == depositor, "Only depositor");
        require(!withdrawn && !refunded, "Already completed");
        require(block.timestamp >= timelock, "Not expired");
        require(address(this).balance >= amount, "Not funded");
        
        refunded = true;
        payable(depositor).transfer(amount);
        
        emit Refunded(depositor);
    }
    
    function isFunded() external view returns (bool) {
        return address(this).balance >= amount;
    }
}