// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title JanusRewards
/// @notice jMEZO's reward accounting. Each reward token streams to holders over a week, so
///         buying jMEZO just before a payout earns nothing. Accounts excluded from rewards
///         (liquidity pools) do not dilute the holders who are paid.
/// @dev Corrections keep past rewards with whoever held the tokens when they accrued, so
///      transfers, mints and burns only move future rewards.
abstract contract JanusRewards is ERC20 {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    using SafeCast for int256;

    uint256 public constant REWARD_DURATION = 7 days;
    uint256 public constant MAX_REWARD_TOKENS = 8;
    uint256 internal constant REWARD_PRECISION = 1e24;
    /// @dev A payout under a tenth of what is still streaming waits in the queue, so dust
    ///      cannot keep pushing the end of a stream back.
    uint256 internal constant MIN_TOPUP_DIVISOR = 10;

    struct Stream {
        uint64 lastUpdate;
        uint64 finish;
        uint256 rate;
        uint256 perShare;
        uint256 accounted;
        uint256 queued;
        uint256 total;
    }

    /// @notice The market's payment token: MUSD. Listed first in the reward tokens.
    IERC20 public immutable rewardToken;

    address[] internal _rewardTokens;
    mapping(address token => bool) public isRewardToken;
    mapping(address token => Stream) internal _streams;
    mapping(address token => mapping(address account => int256)) private _corrections;
    mapping(address token => mapping(address account => uint256)) private _claimed;
    mapping(address account => bool) public isExcluded;
    uint256 public excludedSupply;

    event RewardNotified(address indexed token, uint256 amount, uint256 finish);
    event RewardClaimed(address indexed account, address indexed token, uint256 amount);
    event RewardTokenAdded(address indexed token);
    event ExcludedFromRewards(address indexed account);

    error ZeroAddress();
    error HasBalance();
    error HasUnclaimedRewards();
    error TooManyRewardTokens();
    error RewardTokenExists();

    constructor(IERC20 rewardToken_) {
        if (address(rewardToken_) == address(0)) revert ZeroAddress();
        rewardToken = rewardToken_;
        _addRewardToken(address(rewardToken_));
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function rewardTokens() external view returns (address[] memory) {
        return _rewardTokens;
    }

    function streamFinish(address token) external view returns (uint256) {
        return _streams[token].finish;
    }

    function rewardPerShare() external view returns (uint256) {
        return _perShareNow(_streams[address(rewardToken)]);
    }

    function totalRewards() external view returns (uint256) {
        return _streams[address(rewardToken)].total;
    }

    function accumulatedRewardsToken(address token, address account) public view returns (uint256) {
        if (isExcluded[account]) return 0;
        int256 gross = (_perShareNow(_streams[token]) * balanceOf(account)).toInt256()
            + _corrections[token][account];
        return gross.toUint256() / REWARD_PRECISION;
    }

    function claimableToken(address token, address account) public view returns (uint256) {
        if (isExcluded[account]) return 0;
        return accumulatedRewardsToken(token, account) - _claimed[token][account];
    }

    /// @notice MUSD accrued to `account` over its whole history, claimed or not.
    function accumulatedRewards(address account) public view returns (uint256) {
        return accumulatedRewardsToken(address(rewardToken), account);
    }

    function claimable(address account) public view returns (uint256) {
        return claimableToken(address(rewardToken), account);
    }

    function rewardsClaimed(address account) external view returns (uint256) {
        return _claimed[address(rewardToken)][account];
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    function _addRewardToken(address token) internal {
        if (token == address(0)) revert ZeroAddress();
        if (isRewardToken[token]) revert RewardTokenExists();
        if (_rewardTokens.length >= MAX_REWARD_TOKENS) revert TooManyRewardTokens();
        isRewardToken[token] = true;
        _rewardTokens.push(token);
        emit RewardTokenAdded(token);
    }

    /// @dev One way: an excluded account never earns again, so its corrections cannot pay out.
    function _exclude(address account) internal {
        if (balanceOf(account) != 0) revert HasBalance();
        for (uint256 i = 0; i < _rewardTokens.length; i++) {
            if (claimableToken(_rewardTokens[i], account) != 0) revert HasUnclaimedRewards();
        }
        isExcluded[account] = true;
        emit ExcludedFromRewards(account);
    }

    /// @dev Streams anything held above what is already accounted for.
    function _sync(address token) internal {
        Stream storage s = _streams[token];
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 amount = balance > s.accounted ? balance - s.accounted : 0;
        s.accounted += amount;
        s.total += amount;
        _accrue(s);
        _startStream(token, s, amount);
    }

    /// @dev A token whose balance cannot be read is skipped, so it cannot block the others.
    function _syncAll() internal {
        for (uint256 i = 0; i < _rewardTokens.length; i++) {
            address token = _rewardTokens[i];
            if (_readable(token)) _sync(token);
        }
    }

    function _readable(address token) private view returns (bool) {
        try IERC20(token).balanceOf(address(this)) returns (uint256) {
            return true;
        } catch {
            return false;
        }
    }

    /// @return primary MUSD paid to `account` by this claim.
    function _claimAll(address account) internal returns (uint256 primary) {
        for (uint256 i = 0; i < _rewardTokens.length; i++) {
            address token = _rewardTokens[i];
            uint256 amount = _claimToken(token, account);
            if (token == address(rewardToken)) primary = amount;
        }
    }

    function _claimToken(address token, address account) internal returns (uint256 amount) {
        _accrue(_streams[token]);
        amount = claimableToken(token, account);
        if (amount == 0) return 0;
        _claimed[token][account] += amount;
        _streams[token].accounted -= amount;
        IERC20(token).safeTransfer(account, amount);
        emit RewardClaimed(account, token, amount);
    }

    function _startStream(address token, Stream storage s, uint256 amount) private {
        uint256 pending = amount + s.queued;
        if (pending == 0) return;
        uint256 remaining =
            block.timestamp < s.finish ? ((s.finish - block.timestamp) * s.rate) / REWARD_PRECISION : 0;
        if (pending * MIN_TOPUP_DIVISOR < remaining) {
            s.queued = pending;
            return;
        }
        s.queued = 0;
        s.rate = ((pending + remaining) * REWARD_PRECISION) / REWARD_DURATION;
        s.lastUpdate = block.timestamp.toUint64();
        s.finish = (block.timestamp + REWARD_DURATION).toUint64();
        emit RewardNotified(token, amount, s.finish);
    }

    function _eligibleSupply() private view returns (uint256) {
        return totalSupply() - excludedSupply;
    }

    function _streamedUntil(Stream storage s) private view returns (uint256) {
        return block.timestamp < s.finish ? block.timestamp : s.finish;
    }

    function _perShareNow(Stream storage s) private view returns (uint256) {
        uint256 to = _streamedUntil(s);
        uint256 eligible = _eligibleSupply();
        if (to <= s.lastUpdate || eligible == 0) return s.perShare;
        return s.perShare + ((to - s.lastUpdate) * s.rate) / eligible;
    }

    /// @dev What streams while nobody is eligible goes back in the queue instead of being lost.
    function _accrue(Stream storage s) private {
        uint256 to = _streamedUntil(s);
        if (to <= s.lastUpdate) return;
        uint256 emitted = (to - s.lastUpdate) * s.rate;
        uint256 eligible = _eligibleSupply();
        if (eligible == 0) s.queued += emitted / REWARD_PRECISION;
        else s.perShare += emitted / eligible;
        s.lastUpdate = to.toUint64();
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        uint256 n = _rewardTokens.length;
        for (uint256 i = 0; i < n; i++) {
            _accrue(_streams[_rewardTokens[i]]);
        }
        super._update(from, to, value);
        if (from != address(0) && isExcluded[from]) excludedSupply -= value;
        if (to != address(0) && isExcluded[to]) excludedSupply += value;
        for (uint256 i = 0; i < n; i++) {
            address token = _rewardTokens[i];
            int256 correction = (_streams[token].perShare * value).toInt256();
            if (from != address(0)) _corrections[token][from] += correction;
            if (to != address(0)) _corrections[token][to] -= correction;
        }
    }
}
