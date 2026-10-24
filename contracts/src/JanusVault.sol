// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IVotingEscrow} from "./interfaces/IVotingEscrow.sol";
import {IBoostVoter} from "./interfaces/IBoostVoter.sol";
import {IJanusVault} from "./interfaces/IJanusVault.sol";

/// @title JanusVault
/// @notice Pools permanently locked veMEZO NFTs and issues jMEZO 1:1 against the MEZO
///         they hold. Every NFT stays a separate vote shard that BoostMarket votes
///         with, and the MUSD that boost buyers pay accrues to jMEZO holders pro rata.
/// @dev Deposits arrive through veMEZO.safeTransferFrom. Any shard can be redeemed by
///      burning jMEZO equal to the amount minted for it, so every holder can always
///      exit, whichever NFT they deposited. MEZO added to a shard after deposit stays
///      with that NFT and goes to whoever redeems it.
contract JanusVault is ERC20, IERC721Receiver, IJanusVault, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using SafeCast for uint256;
    using SafeCast for int256;

    /// @notice Upper bound on shards, which keeps every market loop inside the block gas limit.
    uint256 public constant MAX_SHARDS = 100;
    /// @notice Smallest allowed minimum shard size (1 MEZO).
    uint256 public constant MIN_SHARD_FLOOR = 1e18;
    uint256 internal constant REWARD_PRECISION = 1e24;

    IVotingEscrow public immutable veMezo;
    IBoostVoter public immutable boostVoter;
    IERC20 public immutable rewardToken;

    address public market;
    uint256 public minShardAmount;
    /// @notice Cumulative reward per jMEZO, scaled by REWARD_PRECISION.
    uint256 public rewardPerShare;
    uint256 public totalRewards;

    EnumerableSet.UintSet private _shards;
    mapping(uint256 tokenId => uint256 amount) public shardAmount;
    mapping(address account => int256 correction) private _rewardCorrection;
    mapping(address account => uint256 amount) public rewardsClaimed;

    event ShardDeposited(address indexed owner, uint256 indexed tokenId, uint256 amount);
    event ShardRedeemed(address indexed owner, uint256 indexed tokenId, uint256 amount);
    event RewardNotified(uint256 amount, uint256 rewardPerShare);
    event RewardClaimed(address indexed account, uint256 amount);
    event MarketSet(address indexed market);
    event MinShardAmountSet(uint256 amount);
    event StrayNftRecovered(uint256 indexed tokenId, address indexed to);

    error ZeroAddress();
    error VoterMismatch();
    error NotVeMezo();
    error NotMarket();
    error TooManyShards();
    error UnsupportedEscrow();
    error UnvestedGrant();
    error EmptyLock();
    error LockExpired();
    error ShardTooSmall(uint256 amount, uint256 minimum);
    error MinShardTooLow(uint256 amount);
    error UnknownShard(uint256 tokenId);
    error ShardIsRegistered(uint256 tokenId);
    error NoShares();

    modifier onlyMarket() {
        if (msg.sender != market) revert NotMarket();
        _;
    }

    constructor(
        IVotingEscrow veMezo_,
        IBoostVoter boostVoter_,
        IERC20 rewardToken_,
        address owner_,
        uint256 minShardAmount_
    ) ERC20("Janus veMEZO", "jMEZO") Ownable(owner_) {
        if (
            address(veMezo_) == address(0) || address(boostVoter_) == address(0)
                || address(rewardToken_) == address(0)
        ) revert ZeroAddress();
        if (boostVoter_.ve() != address(veMezo_)) revert VoterMismatch();
        if (minShardAmount_ < MIN_SHARD_FLOOR) revert MinShardTooLow(minShardAmount_);
        veMezo = veMezo_;
        boostVoter = boostVoter_;
        rewardToken = rewardToken_;
        minShardAmount = minShardAmount_;
    }

    // ------------------------------------------------------------------
    // Deposits and redemptions
    // ------------------------------------------------------------------

    /// @notice Registers a veMEZO NFT sent with safeTransferFrom and mints jMEZO to the sender.
    /// @dev A lock that is not permanent yet is made permanent, so voting power never decays.
    function onERC721Received(address, address from, uint256 tokenId, bytes calldata)
        external
        override
        nonReentrant
        returns (bytes4)
    {
        if (msg.sender != address(veMezo)) revert NotVeMezo();
        uint256 amount = _registerShard(tokenId);
        _mint(from, amount);
        emit ShardDeposited(from, tokenId, amount);
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Burns jMEZO equal to the shard's minted amount and sends the NFT to the caller.
    function redeem(uint256 tokenId) external nonReentrant {
        if (!_shards.contains(tokenId)) revert UnknownShard(tokenId);
        uint256 amount = shardAmount[tokenId];
        _burn(msg.sender, amount);
        _shards.remove(tokenId);
        delete shardAmount[tokenId];
        veMezo.safeTransferFrom(address(this), msg.sender, tokenId);
        emit ShardRedeemed(msg.sender, tokenId, amount);
    }

    function _registerShard(uint256 tokenId) private returns (uint256 amount) {
        if (_shards.length() >= MAX_SHARDS) revert TooManyShards();
        if (veMezo.escrowType(tokenId) != IVotingEscrow.EscrowType.NORMAL) {
            revert UnsupportedEscrow();
        }
        // An unvested grant can still be revoked by its grant manager.
        if (veMezo.vestingEnd(tokenId) > block.timestamp) revert UnvestedGrant();

        IVotingEscrow.LockedBalance memory lock = veMezo.locked(tokenId);
        if (lock.amount <= 0) revert EmptyLock();
        amount = uint256(int256(lock.amount));
        if (amount < minShardAmount) revert ShardTooSmall(amount, minShardAmount);
        if (!lock.isPermanent) {
            if (lock.end <= block.timestamp) revert LockExpired();
            veMezo.lockPermanent(tokenId);
        }

        _shards.add(tokenId);
        shardAmount[tokenId] = amount;
    }

    // ------------------------------------------------------------------
    // Market hooks
    // ------------------------------------------------------------------

    /// @notice Votes with one shard on BoostVoter. Only the market decides allocations.
    function castVote(uint256 tokenId, address[] calldata gauges, uint256[] calldata weights)
        external
        onlyMarket
        nonReentrant
    {
        if (!_shards.contains(tokenId)) revert UnknownShard(tokenId);
        boostVoter.vote(tokenId, gauges, weights);
    }

    /// @notice Clears one shard's votes on BoostVoter.
    function resetVote(uint256 tokenId) external onlyMarket nonReentrant {
        if (!_shards.contains(tokenId)) revert UnknownShard(tokenId);
        boostVoter.reset(tokenId);
    }

    /// @notice Pulls `amount` reward tokens from the market and credits them to jMEZO holders.
    function notifyReward(uint256 amount) external onlyMarket nonReentrant {
        uint256 supply = totalSupply();
        if (supply == 0) revert NoShares();
        if (amount == 0) return;
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPerShare += (amount * REWARD_PRECISION) / supply;
        totalRewards += amount;
        emit RewardNotified(amount, rewardPerShare);
    }

    // ------------------------------------------------------------------
    // Rewards
    // ------------------------------------------------------------------

    /// @notice Sends the caller every reward accrued to their jMEZO so far.
    function claim() external nonReentrant returns (uint256 amount) {
        amount = claimable(msg.sender);
        if (amount == 0) return 0;
        rewardsClaimed[msg.sender] += amount;
        rewardToken.safeTransfer(msg.sender, amount);
        emit RewardClaimed(msg.sender, amount);
    }

    /// @notice Rewards accrued to `account` over its whole history, claimed or not.
    function accumulatedRewards(address account) public view returns (uint256) {
        int256 gross = (rewardPerShare * balanceOf(account)).toInt256() + _rewardCorrection[account];
        return gross.toUint256() / REWARD_PRECISION;
    }

    function claimable(address account) public view returns (uint256) {
        return accumulatedRewards(account) - rewardsClaimed[account];
    }

    /// @dev Corrections keep past rewards with the account that held the tokens when
    ///      they were notified, so transfers, mints and burns only move future rewards.
    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        int256 correction = (rewardPerShare * value).toInt256();
        if (from != address(0)) _rewardCorrection[from] += correction;
        if (to != address(0)) _rewardCorrection[to] -= correction;
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function isShard(uint256 tokenId) external view returns (bool) {
        return _shards.contains(tokenId);
    }

    function shardCount() external view returns (uint256) {
        return _shards.length();
    }

    function shardIds() external view returns (uint256[] memory) {
        return _shards.values();
    }

    /// @notice Current veMEZO voting power of all shards together.
    function totalVotingPower() external view returns (uint256 power) {
        uint256 n = _shards.length();
        for (uint256 i = 0; i < n; i++) {
            power += veMezo.votingPowerOfNFT(_shards.at(i));
        }
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    function setMarket(address market_) external onlyOwner {
        if (market_ == address(0)) revert ZeroAddress();
        market = market_;
        emit MarketSet(market_);
    }

    function setMinShardAmount(uint256 amount) external onlyOwner {
        if (amount < MIN_SHARD_FLOOR) revert MinShardTooLow(amount);
        minShardAmount = amount;
        emit MinShardAmountSet(amount);
    }

    /// @notice Returns a veMEZO NFT that reached the vault without the receiver hook.
    /// @dev Registered shards back jMEZO and can never be moved this way.
    function recoverStrayNft(uint256 tokenId, address to) external onlyOwner {
        if (_shards.contains(tokenId)) revert ShardIsRegistered(tokenId);
        if (to == address(0)) revert ZeroAddress();
        veMezo.safeTransferFrom(address(this), to, tokenId);
        emit StrayNftRecovered(tokenId, to);
    }
}
