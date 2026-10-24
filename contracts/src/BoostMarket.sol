// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IVotingEscrow} from "./interfaces/IVotingEscrow.sol";
import {IBoostVoter} from "./interfaces/IBoostVoter.sol";
import {IJanusVault} from "./interfaces/IJanusVault.sol";
import {BoostMath} from "./libraries/BoostMath.sol";
import {Epochs} from "./libraries/Epochs.sol";
import {OrderSort} from "./libraries/OrderSort.sol";
import {VoteSplitter} from "./libraries/VoteSplitter.sol";
import {BoostOrders} from "./market/BoostOrders.sol";

/// @title BoostMarket
/// @notice Sells the JanusVault's veMEZO votes to veBTC holders, one round at a time:
///         1. startRound   snapshot every shard that has not voted in this epoch
///         2. resetShards  clear those shards' old votes, so gauge weights are external
///                         only, and record each shard's sellable voting power
///         3. settle       price every order with the exact BoostVoter formula and fill
///                         the highest bids first
///         4. castVotes    vote each shard's slice of the allocation
///         5. finalize     charge each buyer only for votes delivered to its gauge, and
///                         pay jMEZO holders and the treasury
///         Every step is permissionless, so any keeper can drive a round. finalize does
///         not poke boosts: a poke costs 240k to 410k gas on matsnet, and poking every
///         fill could push a full round past the block gas limit and strand it. Boosts
///         are applied afterwards with BoostVoter.pokeBoost, which anyone can call.
contract BoostMarket is BoostOrders {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    using EnumerableSet for EnumerableSet.UintSet;

    enum Phase {
        Idle,
        Resetting,
        Ready,
        Voting,
        Voted
    }

    struct Round {
        uint64 epoch;
        uint64 startedAt;
        Phase phase;
        uint32 cursor;
        uint32 maxGauges;
        address fallbackGauge;
        uint256 supply;
        uint256 filled;
    }

    /// @dev Packed into two slots. Votes are bounded by the veMEZO supply and prices by
    ///      MAX_PRICE_PER_VOTE, so the narrow types cannot overflow in practice.
    struct Fill {
        address gauge;
        uint96 votes;
        uint128 pricePerVote;
        uint128 charged;
    }

    struct Config {
        IJanusVault vault;
        IBoostVoter boostVoter;
        IVotingEscrow veMezo;
        IVotingEscrow veBtc;
        IERC20 musd;
        address treasury;
        address owner;
        uint256 minPricePerVote;
        uint256 feeBps;
    }

    struct Totals {
        uint256 votingTotal;
        uint256 boostableTotal;
    }

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_FEE_BPS = 2_000;
    /// @notice After this long anyone may close a stuck round; undelivered votes cost nothing.
    uint256 public constant ROUND_TIMEOUT = 12 hours;

    IJanusVault public immutable vault;
    IVotingEscrow public immutable veMezo;

    address public treasury;
    uint256 public feeBps;
    /// @notice Gauge that absorbs the unsold remainder of a shard that votes, so a buyer
    ///         never receives votes it did not pay for. Normally the house veBTC gauge.
    address public fallbackGauge;

    uint256 public roundId;
    Round internal _round;

    mapping(uint256 id => uint256[]) internal _roundShards;
    mapping(uint256 id => uint256[]) internal _roundPowers;
    mapping(uint256 id => uint256[]) internal _roundOrders;
    mapping(uint256 id => mapping(uint256 orderId => Fill)) public fills;
    mapping(uint256 id => mapping(address gauge => uint256 votes)) public delivered;

    event RoundStarted(uint256 indexed roundId, uint256 epoch, uint256 shards);
    event ShardsReset(uint256 indexed roundId, uint256 cursor, uint256 total);
    event ShardSkipped(uint256 indexed roundId, uint256 indexed tokenId);
    event OrderFilled(
        uint256 indexed roundId,
        uint256 indexed orderId,
        address gauge,
        uint256 votes,
        uint256 pricePerVote
    );
    event RoundSettled(uint256 indexed roundId, uint256 supply, uint256 filled, uint256 orders);
    event VotesCast(uint256 indexed roundId, uint256 cursor, uint256 total);
    event OrderCharged(
        uint256 indexed roundId, uint256 indexed orderId, uint256 votes, uint256 amount
    );
    event RoundFinalized(uint256 indexed roundId, uint256 charged, uint256 toHolders, uint256 fee);
    event TreasurySet(address indexed treasury);
    event FeeSet(uint256 feeBps);
    event FallbackGaugeSet(address indexed gauge);

    error VoterMismatch();
    error FeeTooHigh(uint256 feeBps);
    error GaugeNotLive(address gauge);
    error FallbackGaugeNotLive();
    error RoundInProgress(uint256 roundId);
    error OutsideVoteWindow();
    error NoEligibleShards();
    error WrongPhase(Phase expected, Phase actual);
    error RoundExpired(uint256 roundId);
    error NoActiveRound();
    error RoundNotComplete(uint256 roundId);

    constructor(Config memory config)
        BoostOrders(
            config.veBtc, config.boostVoter, config.musd, config.owner, config.minPricePerVote
        )
    {
        if (
            address(config.vault) == address(0) || address(config.veMezo) == address(0)
                || config.treasury == address(0)
        ) revert ZeroAddress();
        if (
            config.boostVoter.ve() != address(config.veMezo)
                || config.boostVoter.boostableVe() != address(config.veBtc)
        ) revert VoterMismatch();
        if (config.feeBps > MAX_FEE_BPS) revert FeeTooHigh(config.feeBps);
        vault = config.vault;
        veMezo = config.veMezo;
        treasury = config.treasury;
        feeBps = config.feeBps;
    }

    // ------------------------------------------------------------------
    // Round steps
    // ------------------------------------------------------------------

    /// @notice Opens a round with every shard that has not voted in the current epoch.
    function startRound() external nonReentrant {
        if (_round.phase != Phase.Idle) revert RoundInProgress(roundId);
        if (!Epochs.inVoteWindow(block.timestamp)) revert OutsideVoteWindow();
        uint256 epoch = Epochs.epochStart(block.timestamp);
        uint256 id = roundId + 1;

        uint256[] memory shards = vault.shardIds();
        uint256[] storage snapshot = _roundShards[id];
        for (uint256 i = 0; i < shards.length; i++) {
            if (boostVoter.lastVoted(shards[i]) < epoch) snapshot.push(shards[i]);
        }
        if (snapshot.length == 0) revert NoEligibleShards();

        roundId = id;
        _round = Round({
            epoch: epoch.toUint64(),
            startedAt: block.timestamp.toUint64(),
            phase: Phase.Resetting,
            cursor: 0,
            maxGauges: 0,
            fallbackGauge: address(0),
            supply: 0,
            filled: 0
        });
        emit RoundStarted(id, epoch, snapshot.length);
    }

    /// @notice Clears the previous votes of up to `maxCount` snapshotted shards and records
    ///         the voting power each one can sell this round.
    function resetShards(uint256 maxCount) external nonReentrant {
        Round storage r = _liveRound(Phase.Resetting);
        uint256 id = roundId;
        uint256[] storage shards = _roundShards[id];
        uint256[] storage powers = _roundPowers[id];
        uint256 end = _batchEnd(r.cursor, maxCount, shards.length);
        uint256 added;
        for (uint256 i = r.cursor; i < end; i++) {
            uint256 tokenId = shards[i];
            _resetShard(id, tokenId);
            uint256 power = _usablePower(tokenId, r.epoch);
            powers.push(power);
            added += power;
        }
        r.supply += added;
        _advance(r, end, shards.length, Phase.Ready);
        emit ShardsReset(id, end, shards.length);
    }

    /// @notice Prices every standing order and allocates this round's votes to the
    ///         highest bids, each capped by what it needs to hit its target and by escrow.
    function settle() external nonReentrant {
        Round storage r = _liveRound(Phase.Ready);
        address house = _liveFallback();
        if (house == address(0)) revert FallbackGaugeNotLive();
        uint256 id = roundId;
        uint256 supply = r.supply;
        uint256 filled = supply == 0 ? 0 : _allocate(id, supply);

        r.filled = filled;
        r.fallbackGauge = house;
        r.maxGauges = boostVoter.maxVotingNum().toUint32();
        r.phase = Phase.Voting;
        emit RoundSettled(id, supply, filled, _roundOrders[id].length);
    }

    /// @notice Votes with up to `maxCount` shards according to the settled allocation.
    function castVotes(uint256 maxCount) external nonReentrant {
        Round storage r = _liveRound(Phase.Voting);
        uint256 id = roundId;
        uint256[] storage shards = _roundShards[id];
        VoteSplitter.ShardPlan[] memory plans = _plans(id, r.fallbackGauge, r.maxGauges);
        uint256 end = _batchEnd(r.cursor, maxCount, shards.length);
        for (uint256 i = r.cursor; i < end; i++) {
            _castShard(id, shards[i], plans[i]);
        }
        _advance(r, end, shards.length, Phase.Voted);
        emit VotesCast(id, end, shards.length);
    }

    /// @notice Closes the round: charges delivered votes and pays out revenue.
    ///         A round that stalls past ROUND_TIMEOUT or the epoch's vote window can be
    ///         closed by anyone, and only votes that actually landed are charged.
    function finalize() external nonReentrant {
        Round storage r = _round;
        Phase phase = r.phase;
        if (phase == Phase.Idle) revert NoActiveRound();
        if (phase != Phase.Voted && !_isStale(r)) revert RoundNotComplete(roundId);

        uint256 id = roundId;
        r.phase = Phase.Idle;
        r.cursor = 0;
        uint256 charged = phase >= Phase.Voting ? _chargeFills(id) : 0;
        (uint256 toHolders, uint256 fee) = _distribute(charged);
        emit RoundFinalized(id, charged, toHolders, fee);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function currentRound() external view returns (uint256 id, Round memory info) {
        return (roundId, _round);
    }

    function roundShards(uint256 id) external view returns (uint256[] memory) {
        return _roundShards[id];
    }

    function roundPowers(uint256 id) external view returns (uint256[] memory) {
        return _roundPowers[id];
    }

    function roundOrders(uint256 id) external view returns (uint256[] memory) {
        return _roundOrders[id];
    }

    /// @notice Votes the gauge of veBTC `tokenId` still needs to reach `targetBoost` now.
    function quoteVotes(uint256 tokenId, uint256 targetBoost) external view returns (uint256) {
        address gauge = boostVoter.boostableTokenIdToGauge(tokenId);
        uint256 current = gauge == address(0) ? 0 : boostVoter.weights(gauge);
        return BoostMath.additionalVotes(
            veMezo.totalVotingPower(),
            veBtc.unboostedTotalVotingPower(),
            veBtc.unboostedVotingPowerOfNFT(tokenId),
            targetBoost,
            current
        );
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setFeeBps(uint256 feeBps_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh(feeBps_);
        feeBps = feeBps_;
        emit FeeSet(feeBps_);
    }

    function setFallbackGauge(address gauge) external onlyOwner {
        if (!boostVoter.isGauge(gauge) || !boostVoter.isAlive(gauge)) revert GaugeNotLive(gauge);
        fallbackGauge = gauge;
        emit FallbackGaugeSet(gauge);
    }

    // ------------------------------------------------------------------
    // Internals: settlement
    // ------------------------------------------------------------------

    /// @dev A shard can be sold if it is still in the vault, has not voted this epoch and
    ///      holds no leftover votes (its reset succeeded).
    function _usablePower(uint256 tokenId, uint256 epoch) private view returns (uint256) {
        if (!vault.isShard(tokenId)) return 0;
        if (boostVoter.lastVoted(tokenId) >= epoch) return 0;
        if (boostVoter.usedWeights(tokenId) > 0) return 0;
        return veMezo.votingPowerOfNFT(tokenId);
    }

    function _allocate(uint256 id, uint256 supply) private returns (uint256 filled) {
        Totals memory totals = Totals({
            votingTotal: veMezo.totalVotingPower(),
            boostableTotal: veBtc.unboostedTotalVotingPower()
        });
        if (totals.votingTotal == 0 || totals.boostableTotal == 0) return 0;

        OrderSort.Bid[] memory bids = OrderSort.sorted(_bids());
        uint256 remaining = supply;
        for (uint256 i = 0; i < bids.length && remaining > 0; i++) {
            uint256 orderId = bids[i].orderId;
            (address gauge, uint256 votes) = _fillFor(_orders[orderId], totals, remaining);
            if (votes == 0) continue;
            uint256 price = _orders[orderId].pricePerVote;
            fills[id][orderId] = Fill({
                gauge: gauge,
                votes: votes.toUint96(),
                pricePerVote: price.toUint128(),
                charged: 0
            });
            _roundOrders[id].push(orderId);
            remaining -= votes;
            filled += votes;
            emit OrderFilled(id, orderId, gauge, votes, price);
        }
    }

    function _bids() private view returns (OrderSort.Bid[] memory bids) {
        uint256[] memory ids = _activeOrders.values();
        bids = new OrderSort.Bid[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            bids[i] = OrderSort.Bid({orderId: ids[i], price: _orders[ids[i]].pricePerVote});
        }
    }

    /// @dev Votes for one order: what its gauge still lacks for the target boost, capped
    ///      by the remaining supply and by what the escrow can pay for.
    function _fillFor(Order storage order, Totals memory totals, uint256 remaining)
        private
        view
        returns (address gauge, uint256 votes)
    {
        if (order.pricePerVote < minPricePerVote) return (address(0), 0);
        if (veBtc.ownerOf(order.tokenId) != order.owner) return (address(0), 0);
        gauge = boostVoter.boostableTokenIdToGauge(order.tokenId);
        if (gauge == address(0) || !boostVoter.isAlive(gauge)) return (address(0), 0);

        uint256 boostable = veBtc.unboostedVotingPowerOfNFT(order.tokenId);
        if (boostable == 0 || totals.boostableTotal * BoostMath.PRECISION < boostable) {
            return (address(0), 0);
        }
        uint256 need = BoostMath.additionalVotes(
            totals.votingTotal,
            totals.boostableTotal,
            boostable,
            order.targetBoost,
            boostVoter.weights(gauge)
        );
        uint256 affordable = (order.escrow * VOTE_UNIT) / order.pricePerVote;
        votes = Math.min(need, Math.min(remaining, affordable));
    }

    // ------------------------------------------------------------------
    // Internals: voting
    // ------------------------------------------------------------------

    function _resetShard(uint256 id, uint256 tokenId) private {
        if (!vault.isShard(tokenId) || boostVoter.usedWeights(tokenId) == 0) return;
        try vault.resetVote(tokenId) {}
        catch {
            emit ShardSkipped(id, tokenId);
        }
    }

    function _plans(uint256 id, address house, uint256 maxGauges)
        private
        view
        returns (VoteSplitter.ShardPlan[] memory)
    {
        uint256[] storage orderIds = _roundOrders[id];
        address[] memory gauges = new address[](orderIds.length);
        uint256[] memory amounts = new uint256[](orderIds.length);
        for (uint256 i = 0; i < orderIds.length; i++) {
            Fill storage f = fills[id][orderIds[i]];
            gauges[i] = f.gauge;
            amounts[i] = f.votes;
        }
        return VoteSplitter.split(_roundPowers[id], gauges, amounts, house, maxGauges);
    }

    function _castShard(uint256 id, uint256 tokenId, VoteSplitter.ShardPlan memory plan) private {
        if (plan.gauges.length == 0 || !vault.isShard(tokenId)) return;
        (address[] memory gauges, uint256[] memory weights) = _liveOnly(plan);
        if (gauges.length == 0) return;
        try vault.castVote(tokenId, gauges, weights) {
            for (uint256 j = 0; j < gauges.length; j++) {
                delivered[id][gauges[j]] += boostVoter.votes(tokenId, gauges[j]);
            }
        } catch {
            emit ShardSkipped(id, tokenId);
        }
    }

    /// @dev Drops gauges killed since settlement; BoostVoter would reject the whole vote.
    function _liveOnly(VoteSplitter.ShardPlan memory plan)
        private
        view
        returns (address[] memory gauges, uint256[] memory weights)
    {
        uint256 n = plan.gauges.length;
        bool[] memory alive = new bool[](n);
        uint256 live;
        for (uint256 j = 0; j < n; j++) {
            alive[j] = boostVoter.isAlive(plan.gauges[j]);
            if (alive[j]) live++;
        }
        gauges = new address[](live);
        weights = new uint256[](live);
        uint256 k;
        for (uint256 j = 0; j < n; j++) {
            if (!alive[j]) continue;
            gauges[k] = plan.gauges[j];
            weights[k] = plan.weights[j];
            k++;
        }
    }

    // ------------------------------------------------------------------
    // Internals: charging and payout
    // ------------------------------------------------------------------

    function _chargeFills(uint256 id) private returns (uint256 total) {
        uint256[] storage orderIds = _roundOrders[id];
        for (uint256 i = 0; i < orderIds.length; i++) {
            total += _chargeFill(id, orderIds[i]);
        }
    }

    function _chargeFill(uint256 id, uint256 orderId) private returns (uint256 charge) {
        Fill storage f = fills[id][orderId];
        Order storage order = _orders[orderId];
        uint256 votes = Math.min(f.votes, delivered[id][f.gauge]);
        charge = Math.min(
            order.escrow, Math.mulDiv(votes, f.pricePerVote, VOTE_UNIT, Math.Rounding.Ceil)
        );
        order.escrow -= charge;
        f.charged = charge.toUint128();
        emit OrderCharged(id, orderId, votes, charge);
    }

    function _distribute(uint256 amount) private returns (uint256 toHolders, uint256 fee) {
        if (amount == 0) return (0, 0);
        if (IERC20(address(vault)).totalSupply() == 0) {
            fee = amount;
        } else {
            fee = (amount * feeBps) / BPS;
            toHolders = amount - fee;
        }
        if (fee > 0) musd.safeTransfer(treasury, fee);
        if (toHolders > 0) {
            musd.forceApprove(address(vault), toHolders);
            vault.notifyReward(toHolders);
        }
    }

    // ------------------------------------------------------------------
    // Internals: round bookkeeping
    // ------------------------------------------------------------------

    function _liveRound(Phase expected) private view returns (Round storage r) {
        r = _round;
        if (r.phase != expected) revert WrongPhase(expected, r.phase);
        if (Epochs.epochStart(block.timestamp) != r.epoch) revert RoundExpired(roundId);
        if (!Epochs.inVoteWindow(block.timestamp)) revert OutsideVoteWindow();
    }

    function _advance(Round storage r, uint256 end, uint256 total, Phase next) private {
        if (end == total) {
            r.phase = next;
            r.cursor = 0;
        } else {
            r.cursor = end.toUint32();
        }
    }

    function _batchEnd(uint256 start, uint256 maxCount, uint256 total)
        private
        pure
        returns (uint256)
    {
        if (maxCount == 0) revert ZeroAmount();
        uint256 left = total - start;
        return maxCount >= left ? total : start + maxCount;
    }

    function _isStale(Round storage r) private view returns (bool) {
        return block.timestamp > Epochs.voteEnd(r.epoch)
            || block.timestamp > uint256(r.startedAt) + ROUND_TIMEOUT;
    }

    function _liveFallback() private view returns (address) {
        address gauge = fallbackGauge;
        if (gauge == address(0) || !boostVoter.isAlive(gauge)) return address(0);
        return gauge;
    }

    function _isLocked(uint256 orderId) internal view override returns (bool) {
        Phase phase = _round.phase;
        return (phase == Phase.Voting || phase == Phase.Voted) && fills[roundId][orderId].votes > 0;
    }
}
