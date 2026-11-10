// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IShardLock
/// @notice What JanusVault asks the market before letting a shard leave.
interface IShardLock {
    /// @return True while the current round has counted shards it has not yet voted with.
    function shardsLocked() external view returns (bool);
}
