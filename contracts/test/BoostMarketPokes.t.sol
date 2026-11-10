// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {JanusFixture} from "./utils/JanusFixture.sol";
import {BoostMarket} from "../src/BoostMarket.sol";

/// @notice Wave 2 soundness: every filled order gets its boost poked before the round can
///         close, and a caller cannot starve a vote or poke of gas to make it fail quietly.
contract BoostMarketPokesTest is JanusFixture {
    uint256 internal tokenId;
    uint256 internal orderId;

    function setUp() public override {
        super.setUp();
        _depositShard(alice, 100e18);
        vm.warp(EPOCH + 2 days);
        (tokenId,) = _boostable(carol, 1e18);
        orderId = _placeOrder(carol, tokenId, 1e16, 2e18, 10e18);
    }

    function _toVoting() internal {
        vm.roll(block.number + 1);
        vm.startPrank(keeper);
        market.startRound();
        market.resetShards(type(uint256).max);
        market.settle();
        vm.stopPrank();
    }

    function _toPoking() internal {
        _toVoting();
        vm.prank(keeper);
        market.castVotes(type(uint256).max);
    }

    function test_castVotes_movesToPoking() public {
        _toPoking();
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Poking));
    }

    function test_finalize_revertsUntilBoostsArePoked() public {
        _toPoking();
        vm.expectRevert(abi.encodeWithSelector(BoostMarket.RoundNotComplete.selector, 1));
        market.finalize();
    }

    function test_pokeFills_appliesTheBoostAndAllowsFinalize() public {
        _toPoking();
        market.pokeFills(type(uint256).max);

        assertTrue(market.boostApplied(1, orderId));
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Voted));
        assertEq(veBtc.locked(tokenId).boost, voter.getBoost(tokenId));
        assertGt(voter.getBoost(tokenId), 1e18);
        market.finalize();
    }

    function test_pokeFills_runsInBatches() public {
        (uint256 second,) = _boostable(dave, 1e18);
        uint256 secondOrder = _placeOrder(dave, second, 1e16, 2e18, 100e18);
        _depositShard(bob, 10_000e18);
        _toPoking();

        market.pokeFills(1);
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Poking));
        market.pokeFills(1);
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Voted));
        assertTrue(market.boostApplied(1, orderId) && market.boostApplied(1, secondOrder));
    }

    function test_pokeFills_aFailedPokeDoesNotStrandTheRound() public {
        voter.setPokeReverts(tokenId, true);
        _toPoking();

        vm.expectEmit(true, true, false, false, address(market));
        emit BoostMarket.BoostPokeFailed(1, orderId);
        market.pokeFills(type(uint256).max);

        assertFalse(market.boostApplied(1, orderId));
        market.finalize();
    }

    function test_pokeFills_revertsOutsidePoking() public {
        _toVoting();
        vm.expectRevert(
            abi.encodeWithSelector(BoostMarket.WrongPhase.selector, BoostMarket.Phase.Poking, BoostMarket.Phase.Voting)
        );
        market.pokeFills(1);
    }

    function test_pokeFills_revertsWhenStarvedOfGas() public {
        _toPoking();
        vm.expectRevert();
        market.pokeFills{gas: 300_000}(1);
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Poking));
        assertFalse(market.boostApplied(1, orderId));
    }

    function test_castVotes_revertsWhenStarvedOfGas() public {
        _toVoting();
        vm.expectRevert();
        market.castVotes{gas: 200_000}(1);
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Voting));
    }

    function test_resetShards_revertsWhenStarvedOfGas() public {
        vm.roll(block.number + 1);
        market.startRound();
        vm.expectRevert();
        market.resetShards{gas: 120_000}(1);
    }

    function test_cancel_isLockedWhilePoking() public {
        _toPoking();
        vm.prank(carol);
        vm.expectRevert();
        market.cancelOrder(orderId);
    }

    function test_roundWithoutFills_skipsPoking() public {
        vm.prank(carol);
        market.cancelOrder(orderId);
        vm.roll(block.number + 1);
        vm.startPrank(keeper);
        market.startRound();
        market.resetShards(type(uint256).max);
        market.settle();
        market.castVotes(type(uint256).max);
        vm.stopPrank();
        assertEq(uint256(_phase()), uint256(BoostMarket.Phase.Voted));
    }

    function test_finalize_chargesAFillOnceItsBoostIsApplied() public {
        _toPoking();
        market.pokeFills(type(uint256).max);
        market.finalize();
        (,,, uint128 charged) = market.fills(1, orderId);
        assertGt(charged, 0);
    }

    function test_finalize_doesNotChargeAFillWhosePokeFailed() public {
        voter.setPokeReverts(tokenId, true);
        _toPoking();
        market.pokeFills(type(uint256).max);
        market.finalize();
        (,,, uint128 charged) = market.fills(1, orderId);
        assertEq(charged, 0);
    }

    function test_timedOutRoundInPoking_chargesNobodyLeftUnpoked() public {
        _toPoking();
        skip(market.ROUND_TIMEOUT() + 1);
        market.finalize();
        (,,, uint128 charged) = market.fills(1, orderId);
        assertEq(charged, 0);
    }

    function test_finalize_cannotSkipPokesJustBecauseTheVoteWindowClosed() public {
        vm.warp(EPOCH + 7 days - 2 hours);
        _toPoking();
        vm.warp(EPOCH + 7 days - 1 hours + 1);

        vm.expectRevert(abi.encodeWithSelector(BoostMarket.RoundNotComplete.selector, 1));
        market.finalize();

        market.pokeFills(type(uint256).max);
        assertTrue(market.boostApplied(1, orderId));
    }

    function test_shardsLocked_coversResetThroughVoting() public {
        assertFalse(market.shardsLocked());
        _toVoting();
        assertTrue(market.shardsLocked());
        vm.prank(keeper);
        market.castVotes(type(uint256).max);
        assertFalse(market.shardsLocked());
    }
}
