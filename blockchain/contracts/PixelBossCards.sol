// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Pixel Boss Cards
/// @notice One ERC-721 token per immutable Pixel Bosses card hash.
contract PixelBossCards is ERC721URIStorage, Ownable {
    uint256 public nextTokenId = 1;
    mapping(bytes32 => uint256) public cardToken;

    event CardMinted(address indexed owner, uint256 indexed tokenId, string cardHash, string tokenURI);

    constructor(address initialOwner) ERC721("Pixel Boss Cards", "PBOSS") Ownable(initialOwner) {}

    function mintCard(address to, string calldata cardHash, string calldata tokenURI)
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        require(to != address(0), "Invalid owner");
        require(bytes(cardHash).length > 0, "Missing card hash");
        require(bytes(tokenURI).length > 0, "Missing token URI");

        bytes32 key = keccak256(bytes(cardHash));
        require(cardToken[key] == 0, "Card already minted");

        tokenId = nextTokenId++;
        cardToken[key] = tokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        emit CardMinted(to, tokenId, cardHash, tokenURI);
    }
}
