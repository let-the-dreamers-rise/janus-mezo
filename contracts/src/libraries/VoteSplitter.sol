// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title VoteSplitter
/// @notice Pours a list of gauge targets, in order, into the vault's vote shards.
/// @dev Every veMEZO NFT in the vault votes separately, with at most `maxGauges`
///      gauges per vote. Targets are filled contiguously: a shard spends its power on
///      the current target, moves to the next one when it is complete, and stops when
///      its power is spent or its gauge slots are used up. When a shard votes for at
///      least one target, its unused power goes to `fallbackGauge` if one is set;
///      otherwise the raw amounts are kept and the voter's proportional normalisation
///      spreads the surplus across that shard's targets. A shard with nothing to
///      vote for gets an empty plan, so unsold shards simply abstain.
library VoteSplitter {
    struct ShardPlan {
        address[] gauges;
        uint256[] weights;
    }

    error LengthMismatch();
    error ZeroMaxGauges();

    /// @param powers voting power of each shard, in shard order
    /// @param gauges target gauges, in fill order
    /// @param amounts votes wanted on each target, same length as `gauges`
    /// @param fallbackGauge sink for unused power, or address(0) to keep raw amounts
    /// @param maxGauges BoostVoter.maxVotingNum()
    function split(
        uint256[] memory powers,
        address[] memory gauges,
        uint256[] memory amounts,
        address fallbackGauge,
        uint256 maxGauges
    ) internal pure returns (ShardPlan[] memory plans) {
        if (gauges.length != amounts.length) revert LengthMismatch();
        if (maxGauges == 0) revert ZeroMaxGauges();

        uint256[] memory left = new uint256[](amounts.length);
        for (uint256 i = 0; i < amounts.length; i++) {
            left[i] = amounts[i];
        }

        plans = new ShardPlan[](powers.length);
        uint256 cursor;
        for (uint256 k = 0; k < powers.length; k++) {
            (plans[k], cursor) = _planShard(powers[k], gauges, left, cursor, fallbackGauge, maxGauges);
        }
    }

    function _planShard(
        uint256 power,
        address[] memory gauges,
        uint256[] memory left,
        uint256 cursor,
        address fallbackGauge,
        uint256 maxGauges
    ) private pure returns (ShardPlan memory plan, uint256 next) {
        address[] memory g = new address[](maxGauges);
        uint256[] memory w = new uint256[](maxGauges);
        uint256 n;
        uint256 budget = power;
        uint256 slots = fallbackGauge == address(0) ? maxGauges : maxGauges - 1;

        while (budget > 0 && cursor < gauges.length && n < slots) {
            uint256 want = left[cursor];
            if (want == 0) {
                cursor++;
                continue;
            }
            uint256 take = want < budget ? want : budget;
            g[n] = gauges[cursor];
            w[n] = take;
            n++;
            left[cursor] = want - take;
            budget -= take;
            if (take == want) cursor++;
        }

        if (budget > 0 && n > 0 && fallbackGauge != address(0)) {
            uint256 at = _indexOf(g, n, fallbackGauge);
            if (at < n) {
                w[at] += budget;
            } else {
                g[n] = fallbackGauge;
                w[n] = budget;
                n++;
            }
        }

        plan = ShardPlan({gauges: _trim(g, n), weights: _trim(w, n)});
        next = cursor;
    }

    function _indexOf(address[] memory arr, uint256 n, address needle)
        private
        pure
        returns (uint256)
    {
        for (uint256 i = 0; i < n; i++) {
            if (arr[i] == needle) return i;
        }
        return n;
    }

    function _trim(address[] memory arr, uint256 n) private pure returns (address[] memory out) {
        out = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = arr[i];
        }
    }

    function _trim(uint256[] memory arr, uint256 n) private pure returns (uint256[] memory out) {
        out = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = arr[i];
        }
    }
}
