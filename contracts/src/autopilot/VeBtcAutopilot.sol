// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IRelockableVe {
    struct LockedBalance {
        int128 amount;
        uint256 end;
        bool isPermanent;
    }

    function locked(uint256 tokenId) external view returns (LockedBalance memory);
    function isApprovedOrOwner(address spender, uint256 tokenId) external view returns (bool);
    function increaseUnlockTime(uint256 tokenId, uint256 lockDuration) external;
}

/// @title VeBtcAutopilot
/// @notice Keeps opted-in veBTC locks at the maximum term, so their boost and voting power
///         never decay and the holder never has to re-lock by hand.
/// @dev    A holder opts in with veBTC.approve(autopilot, tokenId) and opts out by revoking
///         the approval. The contract has no owner, no admin and no storage, and the only
///         veBTC function it can call is increaseUnlockTime: it cannot transfer, withdraw,
///         merge or vote with an NFT. Anyone may call relock; it skips tokens it cannot extend.
contract VeBtcAutopilot {
    uint256 internal constant WEEK = 1 weeks;

    IRelockableVe public immutable veBtc;
    /// @notice The veBTC maximum lock term (28 days on Mezo).
    uint256 public immutable lockDuration;

    event Relocked(uint256 indexed tokenId, uint256 newEnd);

    error ZeroAddress();
    error ZeroDuration();

    constructor(IRelockableVe veBtc_, uint256 lockDuration_) {
        if (address(veBtc_) == address(0)) revert ZeroAddress();
        if (lockDuration_ < WEEK) revert ZeroDuration();
        veBtc = veBtc_;
        lockDuration = lockDuration_;
    }

    /// @notice True when relock would push this token's unlock time later right now.
    function canRelock(uint256 tokenId) public view returns (bool) {
        if (!veBtc.isApprovedOrOwner(address(this), tokenId)) return false;
        IRelockableVe.LockedBalance memory lock = veBtc.locked(tokenId);
        if (lock.isPermanent || lock.amount <= 0 || lock.end <= block.timestamp) return false;
        return ((block.timestamp + lockDuration) / WEEK) * WEEK > lock.end;
    }

    /// @notice Extends every listed token that can be extended; returns how many were.
    function relock(uint256[] calldata tokenIds) external returns (uint256 relocked) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            if (!canRelock(tokenId)) continue;
            veBtc.increaseUnlockTime(tokenId, lockDuration);
            relocked++;
            emit Relocked(tokenId, veBtc.locked(tokenId).end);
        }
    }
}
