// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IShardLock} from "./interfaces/IShardLock.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IVotingEscrow} from "./interfaces/IVotingEscrow.sol";
import {IBoostVoter} from "./interfaces/IBoostVoter.sol";
import {IJanusVault} from "./interfaces/IJanusVault.sol";
import {JanusRewards} from "./vault/JanusRewards.sol";

/// @title JanusVault
/// @notice Pools permanently locked veMEZO NFTs and issues jMEZO, a fungible share of all the
///         MEZO they hold. Every NFT stays a separate vote shard that BoostMarket votes with.
///         MUSD from boost buyers and any bribes the shards earn stream to jMEZO holders.
/// @dev Deposits arrive through veMEZO.safeTransferFrom. Any shard can be redeemed by burning
///      its current share of the vault, so MEZO added to a lock benefits every holder rather
///      than whoever redeems that NFT first.
contract JanusVault is JanusRewards, IERC721Receiver, IJanusVault, Ownable2Step, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.UintSet;
    using SafeERC20 for IERC20;

    /// @notice Upper bound on shards, which keeps every market loop inside the block gas limit.
    uint256 public constant MAX_SHARDS = 100;
    /// @notice Smallest allowed minimum shard size (1 MEZO).
    uint256 public constant MIN_SHARD_FLOOR = 1e18;

    IVotingEscrow public immutable veMezo;
    IBoostVoter public immutable boostVoter;

    address public market;
    uint256 public minShardAmount;
    /// @notice Most MEZO the vault accepts. A guard rail for a capped mainnet launch.
    uint256 public depositCap = type(uint256).max;

    EnumerableSet.UintSet private _shards;

    event ShardDeposited(address indexed owner, uint256 indexed tokenId, uint256 amount, uint256 shares);
    event ShardRedeemed(address indexed owner, uint256 indexed tokenId, uint256 amount, uint256 shares);
    event BribesHarvested(uint256 indexed tokenId);
    event MarketSet(address indexed market);
    event MinShardAmountSet(uint256 amount);
    event DepositCapSet(uint256 cap);
    event StrayNftRecovered(uint256 indexed tokenId, address indexed to);

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
    error DepositCapExceeded(uint256 total, uint256 cap);
    error RoundInProgress();

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
    ) ERC20("Janus veMEZO", "jMEZO") JanusRewards(rewardToken_) Ownable(owner_) {
        if (address(veMezo_) == address(0) || address(boostVoter_) == address(0)) revert ZeroAddress();
        if (boostVoter_.ve() != address(veMezo_)) revert VoterMismatch();
        if (minShardAmount_ < MIN_SHARD_FLOOR) revert MinShardTooLow(minShardAmount_);
        veMezo = veMezo_;
        boostVoter = boostVoter_;
        minShardAmount = minShardAmount_;
    }

    // ------------------------------------------------------------------
    // Deposits and redemptions
    // ------------------------------------------------------------------

    /// @notice Registers a veMEZO NFT sent with safeTransferFrom and mints its share to the sender.
    /// @dev A lock that is not permanent yet is made permanent, so voting power never decays.
    function onERC721Received(address, address from, uint256 tokenId, bytes calldata)
        external
        override
        nonReentrant
        returns (bytes4)
    {
        if (msg.sender != address(veMezo)) revert NotVeMezo();
        uint256 assets = totalLocked();
        uint256 amount = _registerShard(tokenId);
        if (assets + amount > depositCap) revert DepositCapExceeded(assets + amount, depositCap);
        uint256 supply = totalSupply();
        uint256 shares = supply == 0 ? amount : Math.mulDiv(amount, supply, assets);
        if (shares == 0) revert NoShares();
        _mint(from, shares);
        emit ShardDeposited(from, tokenId, amount, shares);
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Burns the shard's current share of the vault and sends the NFT to the caller.
    function redeem(uint256 tokenId) external nonReentrant {
        if (!_shards.contains(tokenId)) revert UnknownShard(tokenId);
        if (market != address(0) && IShardLock(market).shardsLocked()) revert RoundInProgress();
        uint256 shares = redeemCost(tokenId);
        uint256 amount = shardAmount(tokenId);
        _burn(msg.sender, shares);
        _shards.remove(tokenId);
        veMezo.safeTransferFrom(address(this), msg.sender, tokenId);
        emit ShardRedeemed(msg.sender, tokenId, amount, shares);
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

    /// @notice Pulls `amount` MUSD from the market and streams it to jMEZO holders.
    function notifyReward(uint256 amount) external onlyMarket nonReentrant {
        if (totalSupply() == 0) revert NoShares();
        if (amount == 0) return;
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        _sync(address(rewardToken));
    }

    // ------------------------------------------------------------------
    // Rewards
    // ------------------------------------------------------------------

    /// @notice Claims bribes a shard earned on BoostVoter and streams them to jMEZO holders.
    ///         Anyone can call it. Tokens not yet registered wait in the vault.
    function harvestBribes(address[] calldata bribes, address[][] calldata tokens, uint256 tokenId)
        external
        nonReentrant
    {
        if (!_shards.contains(tokenId)) revert UnknownShard(tokenId);
        boostVoter.claimBribes(bribes, tokens, tokenId);
        _syncAll();
        emit BribesHarvested(tokenId);
    }

    /// @notice Starts streaming any registered reward token the vault holds but has not accounted.
    function syncRewards() external nonReentrant {
        _syncAll();
    }

    /// @notice Sends the caller every reward streamed to their jMEZO so far.
    /// @return amount MUSD paid by this claim.
    function claim() external nonReentrant returns (uint256 amount) {
        return _claimAll(msg.sender);
    }

    /// @notice Claims one reward token, so a broken token elsewhere cannot trap the rest.
    function claimToken(address token) external nonReentrant returns (uint256 amount) {
        return _claimToken(token, msg.sender);
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

    /// @notice MEZO currently locked in shard `tokenId`, zero if it is not a shard.
    function shardAmount(uint256 tokenId) public view returns (uint256) {
        if (!_shards.contains(tokenId)) return 0;
        return uint256(int256(veMezo.locked(tokenId).amount));
    }

    /// @notice MEZO locked across every shard: the assets behind jMEZO.
    function totalLocked() public view returns (uint256 assets) {
        uint256 n = _shards.length();
        for (uint256 i = 0; i < n; i++) {
            assets += uint256(int256(veMezo.locked(_shards.at(i)).amount));
        }
    }

    /// @notice jMEZO that must be burned to take shard `tokenId` out of the vault.
    function redeemCost(uint256 tokenId) public view returns (uint256) {
        if (!_shards.contains(tokenId)) return 0;
        return Math.mulDiv(shardAmount(tokenId), totalSupply(), totalLocked(), Math.Rounding.Ceil);
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

    function setDepositCap(uint256 cap) external onlyOwner {
        depositCap = cap;
        emit DepositCapSet(cap);
    }

    function addRewardToken(address token) external onlyOwner {
        _addRewardToken(token);
    }

    /// @notice Stops a liquidity pool earning rewards it could never pass on to its LPs.
    ///         Must be set before the account holds jMEZO, and cannot be undone.
    function excludeFromRewards(address account) external onlyOwner {
        _exclude(account);
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
