// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IJanusVault
/// @notice What BoostMarket needs from the vault that holds the veMEZO vote shards.
interface IJanusVault {
    function isShard(uint256 tokenId) external view returns (bool);
    function shardCount() external view returns (uint256);
    function shardIds() external view returns (uint256[] memory);
    function castVote(uint256 tokenId, address[] calldata gauges, uint256[] calldata weights)
        external;
    function resetVote(uint256 tokenId) external;
    function notifyReward(uint256 amount) external;
}
