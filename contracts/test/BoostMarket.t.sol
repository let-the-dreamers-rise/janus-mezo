// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BoostMarket} from "../src/BoostMarket.sol";
import {BoostOrders} from "../src/market/BoostOrders.sol";
import {IVotingEscrow} from "../src/interfaces/IVotingEscrow.sol";
import {IBoostVoter} from "../src/interfaces/IBoostVoter.sol";
import {IJanusVault} from "../src/interfaces/IJanusVault.sol";
import {MockVotingEscrow} from "./mocks/MockVotingEscrow.sol";
import {JanusFixture} from "./utils/JanusFixture.sol";

/// @dev Supply is three shards of 10k, 20k and 30k votes. bob, carol and dave hold veBTC
///      with 1, 2 and 5 units of power, so they need 10k, 20k and 50k votes for 5x.
contract BoostMarketTest is JanusFixture {
    uint256 internal shard1;
    uint256 internal shard2;
    uint256 internal shard3;

    uint256 internal bobNft;
    address internal bobGauge;
    uint256 internal carolNft;
    address internal carolGauge;
    uint256 internal daveNft;
    address internal daveGauge;

    function setUp() public override {
        super.setUp();
        shard1 = _depositShard(alice, 10_000e18);
        shard2 = _depositShard(alice, 20_000e18);
        shard3 = _depositShard(alice, 30_000e18);
        (bobNft, bobGauge) = _boostable(bob, 1e18);
        (carolNft, carolGauge) = _boostable(carol, 2e18);
        (daveNft, daveGauge) = _boostable(dave, 5e18);
        vm.roll(block.number + 1);
    }

    function _settleOnly() internal {
        vm.roll(block.number + 1);
        market.startRound();
        market.resetShards(type(uint256).max);
        market.settle();
    }

    function _escrow(uint256 orderId) internal view returns (uint256) {
        return market.getOrder(orderId).escrow;
    }

    /// @dev What the keeper does once a round closes: apply each buyer's live boost.
    function _applyBoosts() internal {
        uint256[] memory ids = new uint256[](3);
        ids[0] = bobNft;
        ids[1] = carolNft;
        ids[2] = daveNft;
        voter.pokeBoosts(ids);
    }

    // ---- pricing ----

    function test_quoteVotes_matchesTheBoostFormula() public view {
        assertEq(market.quoteVotes(bobNft, 5e18), 10_000e18);
        assertEq(market.quoteVotes(carolNft, 3e18), 10_000e18);
        assertEq(market.quoteVotes(daveNft, 5e18), 50_000e18);
    }

    // ---- full rounds ----

    function test_round_fillsBidsAndBoostsToTarget() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        uint256 carolOrder = _placeOrder(carol, carolNft, 1e15, 5e18, 100e18);

        _runRound();
        _applyBoosts();

        assertEq(voter.weights(bobGauge), 10_000e18);
        assertEq(voter.weights(carolGauge), 20_000e18);
        assertEq(veBtc.locked(bobNft).boost, 5e18);
        assertEq(veBtc.locked(carolNft).boost, 5e18);
        assertEq(_escrow(bobOrder), 80e18);
        assertEq(_escrow(carolOrder), 80e18);
        assertEq(musd.balanceOf(treasury), 4e18);
        assertEq(vault.claimable(alice), 36e18);
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Idle));
    }

    function test_round_recordsFillsAndDelivery() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        _runRound();

        (address gauge, uint256 votes, uint256 price, uint256 charged) = market.fills(1, bobOrder);
        assertEq(gauge, bobGauge);
        assertEq(votes, 10_000e18);
        assertEq(price, 2e15);
        assertEq(charged, 20e18);
        assertEq(market.delivered(1, bobGauge), 10_000e18);
        assertEq(market.roundShards(1).length, 3);
        assertEq(market.roundPowers(1)[2], 30_000e18);
        assertEq(market.roundOrders(1)[0], bobOrder);
    }

    function test_round_highestBidsWinScarceVotes() public {
        uint256 daveOrder = _placeOrder(dave, daveNft, 3e15, 5e18, 200e18);
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        uint256 carolOrder = _placeOrder(carol, carolNft, 1e15, 5e18, 100e18);

        _runRound();

        assertEq(voter.weights(daveGauge), 50_000e18);
        assertEq(voter.weights(bobGauge), 10_000e18);
        assertEq(voter.weights(carolGauge), 0);
        assertEq(_escrow(daveOrder), 50e18);
        assertEq(_escrow(bobOrder), 80e18);
        assertEq(_escrow(carolOrder), 100e18);
    }

    function test_round_partialFillGivesProportionalBoost() public {
        _placeOrder(dave, daveNft, 3e15, 5e18, 200e18);
        uint256 carolOrder = _placeOrder(carol, carolNft, 1e15, 5e18, 100e18);

        _runRound();
        _applyBoosts();

        assertEq(voter.weights(carolGauge), 10_000e18);
        assertEq(veBtc.locked(carolNft).boost, 3e18);
        assertEq(_escrow(carolOrder), 90e18);
    }

    function test_round_budgetCapsTheFillAndTheRestGoesToTheHouse() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 10e18);

        _runRound();
        _applyBoosts();

        assertEq(voter.weights(bobGauge), 5_000e18);
        assertEq(voter.weights(house), 5_000e18);
        assertEq(veBtc.locked(bobNft).boost, 3e18);
        assertEq(_escrow(bobOrder), 0);
    }

    function test_round_externalVotesReduceWhatTheBuyerPays() public {
        voter.addExternalWeight(bobGauge, 4_000e18);
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);

        _runRound();
        _applyBoosts();

        assertEq(voter.weights(bobGauge), 10_000e18);
        assertEq(veBtc.locked(bobNft).boost, 5e18);
        assertEq(_escrow(bobOrder), 88e18);
    }

    function test_round_skipsAnOrderWhoseNftWasSold() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        vm.prank(bob);
        veBtc.transferFrom(bob, carol, bobNft);

        _runRound();

        assertEq(voter.weights(bobGauge), 0);
        assertEq(_escrow(bobOrder), 100e18);
    }

    function test_round_skipsADeadGauge() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        _placeOrder(carol, carolNft, 1e15, 5e18, 100e18);
        voter.killGauge(bobGauge);

        _runRound();

        assertEq(voter.weights(carolGauge), 20_000e18);
        assertEq(_escrow(bobOrder), 100e18);
    }

    function test_round_skipsBidsBelowARaisedMinimum() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        uint256 daveOrder = _placeOrder(dave, daveNft, 3e15, 5e18, 200e18);
        vm.prank(owner);
        market.setMinPricePerVote(3e15);

        _runRound();

        assertEq(voter.weights(bobGauge), 0);
        assertEq(_escrow(bobOrder), 100e18);
        assertEq(_escrow(daveOrder), 50e18);
    }

    function test_round_skipsAnExpiredVeBtcLock() public {
        uint256 nft = veBtc.mint(carol, 2e18, block.timestamp + 1 days, false);
        vm.prank(carol);
        voter.createBoostGauge(address(0), nft, new address[](0), new uint256[](0));
        uint256 orderId = _placeOrder(carol, nft, 1e15, 5e18, 100e18);
        vm.warp(block.timestamp + 2 days);

        _runRound();

        assertEq(_escrow(orderId), 100e18);
        assertEq(market.roundOrders(1).length, 0);
    }

    function test_settle_withoutVeMezoPowerFillsNothing() public {
        _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        veMezo.setTotals(0, 0);
        _runRound();
        assertEq(market.roundOrders(1).length, 0);
    }

    function test_round_voteRejectedByTheVoterIsSkippedAndNotCharged() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        _settleOnly();
        voter.setMaxVotingNum(0);

        vm.expectEmit(address(market));
        emit BoostMarket.ShardSkipped(1, shard1);
        market.castVotes(type(uint256).max);
        market.finalize();

        assertEq(_escrow(bobOrder), 100e18);
        assertEq(voter.weights(bobGauge), 0);
    }

    /// @dev A poke costs 240k to 410k gas on matsnet, so poking every fill would push a
    ///      full round's finalize past the 10M block limit and strand it. Boosts are
    ///      applied afterwards through BoostVoter.pokeBoost, which anyone can call.
    function test_finalize_chargesWithoutPokingBoosts() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        _settleOnly();
        market.castVotes(type(uint256).max);
        uint256 before = veBtc.locked(bobNft).boost;

        vm.expectCall(address(voter), abi.encodeCall(IBoostVoter.pokeBoost, (bobNft)), 0);
        vm.expectCall(address(voter), abi.encodeWithSelector(IBoostVoter.pokeBoosts.selector), 0);
        market.finalize();

        assertEq(_escrow(bobOrder), 80e18);
        assertEq(vault.claimable(alice), 18e18);
        assertEq(veBtc.locked(bobNft).boost, before, "finalize leaves the boost alone");
        assertEq(voter.getBoost(bobNft), 5e18, "a poke would apply 5x");
    }

    function test_finalize_paysEvenWhenBoostsCannotBePoked() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        veBtc.setBooster(address(0xdead));
        _runRound();

        assertEq(_escrow(bobOrder), 80e18);
        assertEq(vault.claimable(alice), 18e18);
    }

    function test_round_withoutBidsLeavesShardsUnvoted() public {
        _runRound();
        assertEq(voter.usedWeights(shard1), 0);
        assertEq(voter.lastVoted(shard1), 0);
        assertEq(musd.balanceOf(treasury), 0);
    }

    // ---- charging only what was delivered ----

    function test_round_redeemedShardIsNotCharged() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        uint256 carolOrder = _placeOrder(carol, carolNft, 1e15, 5e18, 100e18);
        _settleOnly();

        vm.prank(alice);
        vault.redeem(shard2);
        market.castVotes(type(uint256).max);
        market.finalize();

        assertEq(voter.weights(carolGauge), 0);
        assertEq(_escrow(carolOrder), 100e18);
        assertEq(_escrow(bobOrder), 80e18);
        assertEq(vault.claimable(alice), 18e18);
    }

    function test_round_gaugeKilledBeforeVotingIsNotCharged() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        uint256 carolOrder = _placeOrder(carol, carolNft, 1e15, 5e18, 100e18);
        _settleOnly();

        voter.killGauge(carolGauge);
        market.castVotes(type(uint256).max);
        market.finalize();

        assertEq(_escrow(carolOrder), 100e18);
        assertEq(_escrow(bobOrder), 80e18);
    }

    function test_round_allRevenueGoesToTreasuryWhenNoJMezoRemains() public {
        _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        _settleOnly();
        market.castVotes(type(uint256).max);

        vm.startPrank(alice);
        vault.redeem(shard1);
        vault.redeem(shard2);
        vault.redeem(shard3);
        vm.stopPrank();
        market.finalize();

        assertEq(musd.balanceOf(treasury), 20e18);
    }

    // ---- stalled rounds ----

    function test_finalize_staleRoundChargesOnlyDeliveredVotes() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        uint256 carolOrder = _placeOrder(carol, carolNft, 1e15, 5e18, 100e18);
        _settleOnly();
        market.castVotes(1);

        vm.expectRevert(abi.encodeWithSelector(BoostMarket.RoundNotComplete.selector, 1));
        market.finalize();

        vm.warp(block.timestamp + market.ROUND_TIMEOUT() + 1);
        market.finalize();

        assertEq(_escrow(bobOrder), 80e18);
        assertEq(_escrow(carolOrder), 100e18);
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Idle));
    }

    function test_finalize_staleRoundBeforeSettlementChargesNothingAndCanRestart() public {
        _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        market.startRound();
        vm.warp(block.timestamp + market.ROUND_TIMEOUT() + 1);
        market.finalize();

        market.startRound();
        assertEq(market.roundId(), 2);
    }

    function test_round_expiresWithTheEpoch() public {
        _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        vm.warp(EPOCH + 7 days - 2 hours);
        market.startRound();
        vm.warp(EPOCH + 7 days + 2 hours);

        vm.expectRevert(abi.encodeWithSelector(BoostMarket.RoundExpired.selector, 1));
        market.resetShards(1);
        market.finalize();
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Idle));
    }

    // ---- several rounds ----

    function test_round_secondRoundInTheEpochSellsOnlyFreshShards() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        _placeOrder(carol, carolNft, 1e15, 5e18, 100e18);
        _runRound();

        uint256 daveOrder = _placeOrder(dave, daveNft, 3e15, 5e18, 200e18);
        uint256 shard4 = _depositShard(alice, 40_000e18);
        _runRound();

        uint256[] memory sold = market.roundShards(2);
        assertEq(sold.length, 2);
        assertEq(sold[0], shard3);
        assertEq(sold[1], shard4);
        assertEq(voter.weights(daveGauge), 50_000e18);
        assertEq(voter.weights(house), 20_000e18);
        assertEq(_escrow(daveOrder), 50e18);
        assertEq(_escrow(bobOrder), 80e18);
        assertEq(vault.claimable(alice), 36e18 + 135e18);
    }

    function test_round_nextEpochResetsAndResells() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        uint256 carolOrder = _placeOrder(carol, carolNft, 1e15, 5e18, 100e18);
        _runRound();

        vm.warp(EPOCH + 7 days + 2 hours);
        _runRound();
        _applyBoosts();

        assertEq(voter.weights(bobGauge), 10_000e18);
        assertEq(voter.weights(carolGauge), 20_000e18);
        assertEq(_escrow(bobOrder), 60e18);
        assertEq(_escrow(carolOrder), 60e18);
        assertEq(veBtc.locked(bobNft).boost, 5e18);
    }

    /// @dev BoostVoter keeps votes across epochs. A round with no bids must still clear the
    ///      vault's old votes, or last epoch's buyer keeps a boost it no longer pays for.
    function test_round_clearingRoundEndsAnUnpaidBoost() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 20e18);
        _runRound();
        _applyBoosts();
        assertEq(_escrow(bobOrder), 0);
        assertEq(veBtc.locked(bobNft).boost, 5e18, "paid for this epoch");
        uint256 paid = vault.claimable(alice);

        vm.warp(EPOCH + 7 days + 2 hours);
        assertEq(voter.weights(bobGauge), 10_000e18, "votes carried into the new epoch");
        assertEq(market.quoteVotes(bobNft, 5e18), 0, "so no bid looks needed");

        _runRound();
        assertEq(voter.weights(bobGauge), 0);
        assertEq(voter.weights(house), 0);
        assertEq(voter.usedWeights(shard1) + voter.usedWeights(shard2) + voter.usedWeights(shard3), 0);

        voter.pokeBoost(bobNft);
        assertEq(veBtc.locked(bobNft).boost, 1e18);
        assertEq(vault.claimable(alice), paid);
    }

    function test_castVotes_runsInBatches() public {
        _placeOrder(dave, daveNft, 3e15, 5e18, 200e18);
        _settleOnly();

        market.castVotes(1);
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Voting));
        market.castVotes(1);
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Voting));
        market.castVotes(5);
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Voted));
        assertEq(voter.weights(daveGauge), 50_000e18);
        assertEq(voter.weights(house), 10_000e18);

        market.finalize();
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Idle));
    }

    // ---- order locking ----

    function test_orders_lockOnlyWhileTheirRoundCanCharge() public {
        uint256 bobOrder = _placeOrder(bob, bobNft, 2e15, 5e18, 100e18);
        _settleOnly();
        uint256 daveOrder = _placeOrder(dave, daveNft, 3e15, 5e18, 200e18);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(BoostOrders.OrderLocked.selector, bobOrder));
        market.cancelOrder(bobOrder);

        vm.prank(dave);
        market.cancelOrder(daveOrder);

        market.castVotes(type(uint256).max);
        market.finalize();
        vm.prank(bob);
        market.cancelOrder(bobOrder);
        assertEq(musd.balanceOf(bob), 80e18);
    }

    // ---- guards ----

    function test_startRound_onlyInsideTheVoteWindow() public {
        vm.warp(EPOCH + 30 minutes);
        vm.expectRevert(BoostMarket.OutsideVoteWindow.selector);
        market.startRound();

        vm.warp(EPOCH + 7 days - 30 minutes);
        vm.expectRevert(BoostMarket.OutsideVoteWindow.selector);
        market.startRound();
    }

    function test_startRound_needsAnEligibleShard() public {
        vm.startPrank(alice);
        vault.redeem(shard1);
        vault.redeem(shard2);
        vault.redeem(shard3);
        vm.stopPrank();
        vm.expectRevert(BoostMarket.NoEligibleShards.selector);
        market.startRound();
    }

    function test_startRound_oneRoundAtATime() public {
        market.startRound();
        vm.expectRevert(abi.encodeWithSelector(BoostMarket.RoundInProgress.selector, 1));
        market.startRound();
    }

    function test_steps_revertInTheWrongPhase() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                BoostMarket.WrongPhase.selector, BoostMarket.Phase.Resetting, BoostMarket.Phase.Idle
            )
        );
        market.resetShards(1);

        market.startRound();
        vm.expectRevert(
            abi.encodeWithSelector(
                BoostMarket.WrongPhase.selector, BoostMarket.Phase.Ready, BoostMarket.Phase.Resetting
            )
        );
        market.settle();
        vm.expectRevert(
            abi.encodeWithSelector(
                BoostMarket.WrongPhase.selector, BoostMarket.Phase.Voting, BoostMarket.Phase.Resetting
            )
        );
        market.castVotes(1);
        vm.expectRevert(BoostOrders.ZeroAmount.selector);
        market.resetShards(0);
    }

    function test_finalize_needsARound() public {
        vm.expectRevert(BoostMarket.NoActiveRound.selector);
        market.finalize();
    }

    function test_settle_needsALiveHouseGauge() public {
        voter.killGauge(house);
        market.startRound();
        market.resetShards(type(uint256).max);
        vm.expectRevert(BoostMarket.FallbackGaugeNotLive.selector);
        market.settle();
    }

    // ---- admin ----

    function test_admin_settersAreGuarded() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        market.setFeeBps(0);

        vm.startPrank(owner);
        market.setFeeBps(2_000);
        assertEq(market.feeBps(), 2_000);
        vm.expectRevert(abi.encodeWithSelector(BoostMarket.FeeTooHigh.selector, 2_001));
        market.setFeeBps(2_001);

        market.setTreasury(alice);
        assertEq(market.treasury(), alice);
        vm.expectRevert(BoostOrders.ZeroAddress.selector);
        market.setTreasury(address(0));

        address dead = voter.createGauge();
        voter.killGauge(dead);
        vm.expectRevert(abi.encodeWithSelector(BoostMarket.GaugeNotLive.selector, dead));
        market.setFallbackGauge(dead);
        vm.expectRevert(abi.encodeWithSelector(BoostMarket.GaugeNotLive.selector, alice));
        market.setFallbackGauge(alice);
        vm.stopPrank();
    }

    function test_constructor_rejectsMismatchedEscrows() public {
        MockVotingEscrow other = new MockVotingEscrow(28 days);
        BoostMarket.Config memory config = _config();
        config.veBtc = IVotingEscrow(address(other));
        vm.expectRevert(BoostMarket.VoterMismatch.selector);
        new BoostMarket(config);
    }

    function test_constructor_rejectsExcessiveFee() public {
        BoostMarket.Config memory config = _config();
        config.feeBps = 2_001;
        vm.expectRevert(abi.encodeWithSelector(BoostMarket.FeeTooHigh.selector, 2_001));
        new BoostMarket(config);
    }

    function _config() internal view returns (BoostMarket.Config memory) {
        return BoostMarket.Config({
            vault: IJanusVault(address(vault)),
            boostVoter: IBoostVoter(address(voter)),
            veMezo: IVotingEscrow(address(veMezo)),
            veBtc: IVotingEscrow(address(veBtc)),
            musd: IERC20(address(musd)),
            treasury: treasury,
            owner: owner,
            minPricePerVote: MIN_PRICE,
            feeBps: FEE_BPS
        });
    }
}
