// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title BoostMath
/// @notice Exact mirror of BoostVoter._getBoost and its inverse: the minimal number of
///         veMEZO votes a boost gauge needs for its veBTC NFT to reach a target boost.
/// @dev All inputs are 1e18-scaled voting power units as read from the escrows:
///      total           veMEZO.totalVotingPower()
///      boostableTotal  veBTC.unboostedTotalVotingPower()
///      boostable       veBTC.unboostedVotingPowerOfNFT(tokenId)
///      weight          BoostVoter.weights(gauge)
library BoostMath {
    uint256 internal constant PRECISION = 1e18;
    uint256 internal constant BASE_BOOST = 1e18;
    uint256 internal constant MAX_BOOST = 5e18;
    uint256 internal constant BOOST_MULTIPLIER = 4;

    error Unboostable();
    error InvalidTarget();

    /// @notice Boost factor BoostVoter reports for a veBTC NFT whose gauge holds `weight` votes.
    function boostOf(uint256 total, uint256 boostableTotal, uint256 boostable, uint256 weight)
        internal
        pure
        returns (uint256)
    {
        uint256 votingRatio = total > 0 ? (weight * PRECISION) / total : 0;
        uint256 boostableRatio = boostable > 0 ? (boostableTotal * PRECISION) / boostable : 0;
        uint256 fraction = (BOOST_MULTIPLIER * boostableRatio * votingRatio) / PRECISION;
        uint256 boost = BASE_BOOST + fraction;
        return boost > MAX_BOOST ? MAX_BOOST : boost;
    }

    /// @notice Minimal gauge weight such that boostOf(...) >= target.
    /// @dev Inverts the two floor divisions exactly, so the result is tight: one vote
    ///      less falls short of the target.
    function votesForBoost(
        uint256 total,
        uint256 boostableTotal,
        uint256 boostable,
        uint256 target
    ) internal pure returns (uint256) {
        if (target > MAX_BOOST) revert InvalidTarget();
        if (target <= BASE_BOOST) return 0;
        if (boostable == 0 || total == 0) revert Unboostable();
        uint256 boostableRatio = (boostableTotal * PRECISION) / boostable;
        if (boostableRatio == 0) revert Unboostable();

        uint256 delta = target - BASE_BOOST;
        // floor(4 * br * vr / 1e18) >= delta  <=>  vr >= ceil(delta * 1e18 / (4 * br))
        uint256 votingRatio = Math.ceilDiv(delta * PRECISION, BOOST_MULTIPLIER * boostableRatio);
        // floor(w * 1e18 / total) >= vr  <=>  w >= ceil(vr * total / 1e18)
        return Math.ceilDiv(votingRatio * total, PRECISION);
    }

    /// @notice Votes still missing on a gauge that already holds `currentWeight` votes.
    function additionalVotes(
        uint256 total,
        uint256 boostableTotal,
        uint256 boostable,
        uint256 target,
        uint256 currentWeight
    ) internal pure returns (uint256) {
        uint256 need = votesForBoost(total, boostableTotal, boostable, target);
        return need > currentWeight ? need - currentWeight : 0;
    }
}
