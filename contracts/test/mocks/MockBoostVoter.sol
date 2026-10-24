// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockVotingEscrow} from "./MockVotingEscrow.sol";

/// @notice Test double for Mezo's BoostVoter. vote, reset and the boost formula are
///         transcribed from the verified NonStakingVoter and BoostVoter sources, minus
///         bribe and emission bookkeeping. It deliberately does not reuse Janus code.
contract MockBoostVoter {
    error AlreadyVotedOrDeposited();
    error DistributeWindow();
    error NotApprovedOrOwner();
    error UnequalLengths();
    error TooManyGauges();
    error NotWhitelistedNFT();
    error GaugeDoesNotExist(address gauge);
    error GaugeNotAlive(address gauge);
    error NonZeroVotes();
    error ZeroBalance();
    error GaugeExistsForLock();

    uint256 internal constant WEEK = 7 days;

    address public immutable ve;
    address public immutable boostableVe;
    uint256 public maxVotingNum = 30;
    uint256 public totalWeight;

    mapping(address => uint256) public weights;
    mapping(uint256 => mapping(address => uint256)) public votes;
    mapping(uint256 => address[]) internal _gaugeVote;
    mapping(uint256 => uint256) public usedWeights;
    mapping(uint256 => uint256) public lastVoted;
    mapping(address => bool) public isGauge;
    mapping(address => bool) public isAlive;
    mapping(uint256 => address) public boostableTokenIdToGauge;
    uint256 internal _gaugeNonce;

    constructor(address ve_, address boostableVe_) {
        ve = ve_;
        boostableVe = boostableVe_;
    }

    modifier onlyNewEpoch(uint256 tokenId) {
        if (_epochStart(block.timestamp) <= lastVoted[tokenId]) revert AlreadyVotedOrDeposited();
        if (block.timestamp <= _epochStart(block.timestamp) + 1 hours) revert DistributeWindow();
        _;
    }

    // ---- test setup ----

    function createGauge() external returns (address) {
        return _newGauge();
    }

    function killGauge(address gauge) external {
        isAlive[gauge] = false;
    }

    function addExternalWeight(address gauge, uint256 amount) external {
        weights[gauge] += amount;
        totalWeight += amount;
    }

    function setMaxVotingNum(uint256 maxVotingNum_) external {
        maxVotingNum = maxVotingNum_;
    }

    // ---- BoostVoter surface ----

    function createBoostGauge(address, uint256 boostableTokenId, address[] calldata, uint256[] calldata)
        external
        returns (address gauge)
    {
        if (!MockVotingEscrow(boostableVe).isApprovedOrOwner(msg.sender, boostableTokenId)) {
            revert NotApprovedOrOwner();
        }
        if (boostableTokenIdToGauge[boostableTokenId] != address(0)) revert GaugeExistsForLock();
        gauge = _newGauge();
        boostableTokenIdToGauge[boostableTokenId] = gauge;
    }

    function vote(uint256 tokenId, address[] calldata gauges, uint256[] calldata weights_)
        external
        onlyNewEpoch(tokenId)
    {
        if (!MockVotingEscrow(ve).isApprovedOrOwner(msg.sender, tokenId)) revert NotApprovedOrOwner();
        if (gauges.length != weights_.length) revert UnequalLengths();
        if (gauges.length > maxVotingNum) revert TooManyGauges();
        uint256 ts = block.timestamp;
        if (ts > _epochStart(ts) + WEEK - 1 hours) revert NotWhitelistedNFT();
        lastVoted[tokenId] = ts;
        _vote(tokenId, MockVotingEscrow(ve).votingPowerOfNFT(tokenId), gauges, weights_);
    }

    function reset(uint256 tokenId) external onlyNewEpoch(tokenId) {
        if (!MockVotingEscrow(ve).isApprovedOrOwner(msg.sender, tokenId)) revert NotApprovedOrOwner();
        _reset(tokenId);
    }

    function getBoost(uint256 boostableTokenId) public view returns (uint256) {
        address gauge = boostableTokenIdToGauge[boostableTokenId];
        uint256 votingVeWeight = weights[gauge];
        uint256 votingVeTotalWeight = MockVotingEscrow(ve).totalVotingPower();
        uint256 votingVeRatio = 0;
        if (votingVeTotalWeight > 0) {
            votingVeRatio = (votingVeWeight * 1e18) / votingVeTotalWeight;
        }
        uint256 boostableVeTotalWeight = MockVotingEscrow(boostableVe).unboostedTotalVotingPower();
        uint256 boostableVeWeight =
            MockVotingEscrow(boostableVe).unboostedVotingPowerOfNFT(boostableTokenId);
        uint256 boostableVeRatio = 0;
        if (boostableVeWeight > 0) {
            boostableVeRatio = (boostableVeTotalWeight * 1e18) / boostableVeWeight;
        }
        uint256 boostFraction = (4 * boostableVeRatio * votingVeRatio) / 1e18;
        uint256 boost = 1e18 + boostFraction;
        return boost > 5e18 ? 5e18 : boost;
    }

    function pokeBoost(uint256 boostableTokenId) public {
        MockVotingEscrow(boostableVe).updateBoost(boostableTokenId, getBoost(boostableTokenId));
    }

    function pokeBoosts(uint256[] calldata boostableTokenIds) external {
        for (uint256 i = 0; i < boostableTokenIds.length; i++) {
            pokeBoost(boostableTokenIds[i]);
        }
    }

    // ---- internals transcribed from NonStakingVoter ----

    function _reset(uint256 tokenId) internal {
        address[] storage gaugeVote = _gaugeVote[tokenId];
        uint256 removed = 0;
        for (uint256 i = 0; i < gaugeVote.length; i++) {
            address gauge = gaugeVote[i];
            uint256 v = votes[tokenId][gauge];
            if (v != 0) {
                weights[gauge] -= v;
                delete votes[tokenId][gauge];
                removed += v;
            }
        }
        MockVotingEscrow(ve).voting(tokenId, false);
        totalWeight -= removed;
        usedWeights[tokenId] = 0;
        delete _gaugeVote[tokenId];
    }

    function _vote(uint256 tokenId, uint256 weight, address[] memory gauges, uint256[] memory w)
        internal
    {
        _reset(tokenId);
        uint256 totalVoteWeight = 0;
        for (uint256 i = 0; i < gauges.length; i++) {
            totalVoteWeight += w[i];
        }
        uint256 used = 0;
        for (uint256 i = 0; i < gauges.length; i++) {
            address gauge = gauges[i];
            if (!isGauge[gauge]) revert GaugeDoesNotExist(gauge);
            if (!isAlive[gauge]) revert GaugeNotAlive(gauge);
            uint256 gaugeWeight = (w[i] * weight) / totalVoteWeight;
            if (votes[tokenId][gauge] != 0) revert NonZeroVotes();
            if (gaugeWeight == 0) revert ZeroBalance();
            _gaugeVote[tokenId].push(gauge);
            weights[gauge] += gaugeWeight;
            votes[tokenId][gauge] += gaugeWeight;
            used += gaugeWeight;
        }
        if (used > 0) MockVotingEscrow(ve).voting(tokenId, true);
        totalWeight += used;
        usedWeights[tokenId] = used;
    }

    function _newGauge() internal returns (address gauge) {
        gauge = address(uint160(uint256(keccak256(abi.encode("janus-test-gauge", ++_gaugeNonce)))));
        isGauge[gauge] = true;
        isAlive[gauge] = true;
    }

    function _epochStart(uint256 ts) internal pure returns (uint256) {
        return ts - (ts % WEEK);
    }
}
