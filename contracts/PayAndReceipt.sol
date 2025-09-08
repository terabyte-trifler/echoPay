// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReceiptNFT {
    function mint(address to, string calldata uri) external returns (uint256);
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function decimals() external view returns (uint8); // optional; some tokens don't implement
}

contract PayAndReceipt {
    event ReceiptIssued(
        uint256 indexed receiptId,
        address indexed payer,
        address indexed merchant,
        address token,        // address(0) for native
        uint256 amount,
        string  code,
        string  metaURI
    );

    address public owner;
    IReceiptNFT public receipt;

    modifier onlyOwner() { require(msg.sender == owner, "!owner"); _; }

    constructor(address receiptNft) {
        owner = msg.sender;
        receipt = IReceiptNFT(receiptNft);
    }

    // === ETH ===
    function payETH(address merchant, string calldata code, string calldata metaURI)
      external payable
    {
        require(msg.value > 0, "zero");
        (bool s,) = payable(merchant).call{value: msg.value}("");
        require(s, "xfer fail");

        uint256 id = receipt.mint(msg.sender, metaURI);
        emit ReceiptIssued(id, msg.sender, merchant, address(0), msg.value, code, metaURI);
    }

    // === ERC-20 ===
    function pay(address erc20, uint256 amount, address merchant, string calldata code, string calldata metaURI)
      external
    {
        require(erc20 != address(0), "erc20=0");
        require(amount > 0, "zero");
        require(IERC20(erc20).transferFrom(msg.sender, merchant, amount), "transferFrom fail");

        uint256 id = receipt.mint(msg.sender, metaURI);
        emit ReceiptIssued(id, msg.sender, merchant, erc20, amount, code, metaURI);
    }
}
