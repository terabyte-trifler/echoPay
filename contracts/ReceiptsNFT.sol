// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ReceiptNFT is ERC721URIStorage, Ownable {
    uint256 public nextId;

    // 👇 IMPORTANT: pass the initial owner to Ownable (OZ v5 requirement)
    constructor(string memory name_, string memory symbol_)
        ERC721(name_, symbol_)
        Ownable(msg.sender)
    {}

    function mint(address to, string memory uri) external onlyOwner returns (uint256 id) {
        id = ++nextId;
        _safeMint(to, id);
        _setTokenURI(id, uri);
    }
}
