// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BoostMath} from "../../src/libraries/BoostMath.sol";

/// @dev External wrapper so expectRevert sees the library revert at call depth + 1.
contract BoostMathHarness {
    function votesForBoost(uint256 total, uint256 boostableTotal, uint256 boostable, uint256 target)
        external
        pure
        returns (uint256)
    {
        return BoostMath.votesForBoost(total, boostableTotal, boostable, target);
    }
}

contract BoostMathTest is Test {
    // Matsnet-like magnitudes: 88.7M veMEZO voting power, 16.93 veBTC unboosted power.
    uint256 internal constant T = 88_735_452e18;
    uint256 internal constant U = 16_932_100_492_039_704_579;

    BoostMathHarness internal harness;

    function setUp() public {
        harness = new BoostMathHarness();
    }

    function test_boostOf_isOneWithoutVotes() public pure {
        assertEq(BoostMath.boostOf(T, U, 1e15, 0), 1e18);
    }

    function test_boostOf_isOneWhenBoostableHasNoPower() public pure {
        assertEq(BoostMath.boostOf(T, U, 0, 1e24), 1e18);
    }

    function test_boostOf_capsAtFive() public pure {
        assertEq(BoostMath.boostOf(T, U, 1e15, T), 5e18);
    }

    function test_boostOf_matchesBoostVoterFormula() public pure {
        uint256 u = 25e15;
        uint256 w = 50_000e18;
        uint256 votingRatio = (w * 1e18) / T;
        uint256 boostableRatio = (U * 1e18) / u;
        uint256 expected = 1e18 + (4 * boostableRatio * votingRatio) / 1e18;
        assertEq(BoostMath.boostOf(T, U, u, w), expected);
    }

    function test_votesForBoost_zeroForNoExtraBoost() public pure {
        assertEq(BoostMath.votesForBoost(T, U, 1e15, 1e18), 0);
    }

    function test_votesForBoost_isMinimalForFullBoost() public pure {
        uint256 u = 25e15;
        uint256 w = BoostMath.votesForBoost(T, U, u, 5e18);
        assertEq(BoostMath.boostOf(T, U, u, w), 5e18);
        assertLt(BoostMath.boostOf(T, U, u, w - 1), 5e18);
    }

    function test_votesForBoost_revertsWhenUnboostable() public {
        vm.expectRevert(BoostMath.Unboostable.selector);
        harness.votesForBoost(T, U, 0, 5e18);
    }

    function test_votesForBoost_revertsAboveMaxBoost() public {
        vm.expectRevert(BoostMath.InvalidTarget.selector);
        harness.votesForBoost(T, U, 1e15, 5e18 + 1);
    }

    function test_votesForBoost_revertsWhenRatioRoundsToZero() public {
        // boostable power above the boostable total can only come from a broken escrow.
        vm.expectRevert(BoostMath.Unboostable.selector);
        harness.votesForBoost(T, 1, 1e36, 5e18);
    }

    function test_additionalVotes_subtractsExistingWeight() public pure {
        uint256 u = 25e15;
        uint256 need = BoostMath.votesForBoost(T, U, u, 5e18);
        assertEq(BoostMath.additionalVotes(T, U, u, 5e18, need / 2), need - need / 2);
        assertEq(BoostMath.additionalVotes(T, U, u, 5e18, need), 0);
        assertEq(BoostMath.additionalVotes(T, U, u, 5e18, need * 2), 0);
    }

    function testFuzz_votesForBoost_isMinimal(
        uint256 total,
        uint256 boostableTotal,
        uint256 boostable,
        uint256 target
    ) public pure {
        total = bound(total, 1e18, 1e30);
        boostableTotal = bound(boostableTotal, 1e12, 1e27);
        boostable = bound(boostable, 1, boostableTotal);
        target = bound(target, 1e18 + 1, 5e18);

        uint256 w = BoostMath.votesForBoost(total, boostableTotal, boostable, target);
        assertGe(BoostMath.boostOf(total, boostableTotal, boostable, w), target);
        assertGt(w, 0);
        assertLt(BoostMath.boostOf(total, boostableTotal, boostable, w - 1), target);
    }
}
