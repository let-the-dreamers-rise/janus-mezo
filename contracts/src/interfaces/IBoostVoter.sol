// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IBoostVoter
/// @notice Minimal surface of Mezo's BoostVoter (NonStakingVoter + IVotingEscrowBooster)
///         used by Janus. veMEZO NFTs vote on boost gauges; each boost gauge belongs to
///         one veBTC NFT and the votes it receives raise that NFT's Earn boost up to 5x.
interface IBoostVoter {
    function ve() external view returns (address);
    function boostableVe() external view returns (address);
    function maxVotingNum() external view returns (uint256);
    function totalWeight() external view returns (uint256);
    function weights(address gauge) external view returns (uint256);
    function votes(uint256 tokenId, address gauge) external view returns (uint256);
    function usedWeights(uint256 tokenId) external view returns (uint256);
    function lastVoted(uint256 tokenId) external view returns (uint256);
    function isGauge(address gauge) external view returns (bool);
    function isAlive(address gauge) external view returns (bool);
    function boostableTokenIdToGauge(uint256 boostableTokenId) external view returns (address);
    function getBoost(uint256 boostableTokenId) external view returns (uint256);
    function epochStart(uint256 timestamp) external pure returns (uint256);
    function epochVoteStart(uint256 timestamp) external pure returns (uint256);
    function epochVoteEnd(uint256 timestamp) external pure returns (uint256);

    function vote(uint256 tokenId, address[] calldata gauges, uint256[] calldata weights)
        external;
    function reset(uint256 tokenId) external;
    function poke(uint256 tokenId) external;
    function pokeBoost(uint256 boostableTokenId) external;
    function pokeBoosts(uint256[] calldata boostableTokenIds) external;
    function createBoostGauge(
        address gaugeFactory,
        uint256 boostableTokenId,
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external returns (address);
}
