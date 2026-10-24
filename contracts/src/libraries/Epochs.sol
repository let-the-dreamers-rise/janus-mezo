// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Epochs
/// @notice Mezo voting epochs, mirroring ProtocolTimeLibrary and the checks in
///         NonStakingVoter.vote: epochs are UTC weeks starting on Thursday, and a
///         veNFT may vote strictly after the first hour and no later than one hour
///         before the epoch ends.
library Epochs {
    uint256 internal constant WEEK = 7 days;
    uint256 internal constant VOTE_MARGIN = 1 hours;

    function epochStart(uint256 timestamp) internal pure returns (uint256) {
        return timestamp - (timestamp % WEEK);
    }

    function epochNext(uint256 timestamp) internal pure returns (uint256) {
        return epochStart(timestamp) + WEEK;
    }

    function voteStart(uint256 timestamp) internal pure returns (uint256) {
        return epochStart(timestamp) + VOTE_MARGIN;
    }

    function voteEnd(uint256 timestamp) internal pure returns (uint256) {
        return epochStart(timestamp) + WEEK - VOTE_MARGIN;
    }

    /// @notice True when NonStakingVoter.vote accepts a vote at `timestamp`.
    function inVoteWindow(uint256 timestamp) internal pure returns (bool) {
        return timestamp > voteStart(timestamp) && timestamp <= voteEnd(timestamp);
    }
}
