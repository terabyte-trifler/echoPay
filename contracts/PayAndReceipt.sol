// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReceiptNFT {
    function mint(address to, string calldata uri) external returns (uint256);
}

contract PayAndReceipt {
    event ReceiptIssued(
        uint256 indexed receiptId,
        address indexed payer,
        address indexed merchant,
        address token,            // address(0) for native
        uint256 amount,
        string  code,             // short code for QR/verify
        string  metaURI           // where off-chain receipt JSON/image lives
    );

    address public owner;
    IReceiptNFT public receipt;

    modifier onlyOwner() { require(msg.sender == owner, "!owner"); _; }

    constructor(address receiptNft) {
        owner = msg.sender;
        receipt = IReceiptNFT(receiptNft);
    }

    // pay in native (S on Sonic) and mint a receipt NFT to payer
    function payETH(address merchant, string calldata code, string calldata metaURI) external payable {
        require(msg.value > 0, "zero");
        (bool s,) = payable(merchant).call{value: msg.value}("");
        require(s, "xfer fail");

        uint256 id = receipt.mint(msg.sender, metaURI);
        emit ReceiptIssued(id, msg.sender, merchant, address(0), msg.value, code, metaURI);
    }
}
