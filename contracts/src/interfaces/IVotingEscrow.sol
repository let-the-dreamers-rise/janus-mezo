// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVotingEscrow
/// @notice Minimal surface of Mezo's VotingEscrow (veMEZO and veBTC) used by Janus.
/// @dev Mirrors the verified implementation on matsnet and mainnet. Only the
///      functions Janus calls or reads are declared.
interface IVotingEscrow {
    enum EscrowType {
        NORMAL,
        LOCKED,
        MANAGED
    }

    struct LockedBalance {
        int128 amount;
        uint256 end;
        bool isPermanent;
        uint256 boost;
    }

    function token() external view returns (address);
    function tokenId() external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
    function ownerToNFTokenIdList(address owner, uint256 index) external view returns (uint256);
    function locked(uint256 tokenId) external view returns (LockedBalance memory);
    function escrowType(uint256 tokenId) external view returns (EscrowType);
    function voted(uint256 tokenId) external view returns (bool);
    function vestingEnd(uint256 tokenId) external view returns (uint256);
    function grantManager(uint256 tokenId) external view returns (address);
    function votingPowerOfNFT(uint256 tokenId) external view returns (uint256);
    function unboostedVotingPowerOfNFT(uint256 tokenId) external view returns (uint256);
    function totalVotingPower() external view returns (uint256);
    function unboostedTotalVotingPower() external view returns (uint256);
    function isApprovedOrOwner(address spender, uint256 tokenId) external view returns (bool);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);

    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function lockPermanent(uint256 tokenId) external;
    function createLock(uint256 value, uint256 lockDuration) external returns (uint256);
    function createLockFor(uint256 value, uint256 lockDuration, address to)
        external
        returns (uint256);
}
