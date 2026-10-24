// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VoteSplitter} from "../../src/libraries/VoteSplitter.sol";

/// @dev External wrapper so expectRevert sees the library revert at call depth + 1.
contract VoteSplitterHarness {
    function split(
        uint256[] memory powers,
        address[] memory gauges,
        uint256[] memory amounts,
        address fallbackGauge,
        uint256 maxGauges
    ) external pure returns (VoteSplitter.ShardPlan[] memory) {
        return VoteSplitter.split(powers, gauges, amounts, fallbackGauge, maxGauges);
    }
}

contract VoteSplitterTest is Test {
    VoteSplitterHarness internal harness;

    function setUp() public {
        harness = new VoteSplitterHarness();
    }

    address internal constant G1 = address(0x1001);
    address internal constant G2 = address(0x1002);
    address internal constant G3 = address(0x1003);
    address internal constant FALLBACK = address(0xFA11);

    function _targets(uint256 a, uint256 b, uint256 c)
        internal
        pure
        returns (address[] memory gauges, uint256[] memory amounts)
    {
        gauges = new address[](3);
        amounts = new uint256[](3);
        gauges[0] = G1;
        gauges[1] = G2;
        gauges[2] = G3;
        amounts[0] = a;
        amounts[1] = b;
        amounts[2] = c;
    }

    function _powers(uint256 a) internal pure returns (uint256[] memory p) {
        p = new uint256[](1);
        p[0] = a;
    }

    function _powers(uint256 a, uint256 b) internal pure returns (uint256[] memory p) {
        p = new uint256[](2);
        p[0] = a;
        p[1] = b;
    }

    function _sum(uint256[] memory xs) internal pure returns (uint256 s) {
        for (uint256 i = 0; i < xs.length; i++) {
            s += xs[i];
        }
    }

    function test_singleShard_exactFit() public pure {
        (address[] memory gauges, uint256[] memory amounts) = _targets(10, 20, 30);
        VoteSplitter.ShardPlan[] memory plans =
            VoteSplitter.split(_powers(60), gauges, amounts, address(0), 30);

        assertEq(plans.length, 1);
        assertEq(plans[0].gauges.length, 3);
        assertEq(plans[0].weights[0], 10);
        assertEq(plans[0].weights[1], 20);
        assertEq(plans[0].weights[2], 30);
    }

    function test_singleShard_leftoverGoesToFallback() public pure {
        (address[] memory gauges, uint256[] memory amounts) = _targets(10, 20, 30);
        VoteSplitter.ShardPlan[] memory plans =
            VoteSplitter.split(_powers(100), gauges, amounts, FALLBACK, 30);

        assertEq(plans[0].gauges.length, 4);
        assertEq(plans[0].gauges[3], FALLBACK);
        assertEq(plans[0].weights[3], 40);
        assertEq(_sum(plans[0].weights), 100);
    }

    function test_singleShard_leftoverWithoutFallbackKeepsRawAmounts() public pure {
        // The voter normalises weights per NFT, so raw amounts spread the
        // leftover proportionally across the targeted gauges.
        (address[] memory gauges, uint256[] memory amounts) = _targets(10, 20, 30);
        VoteSplitter.ShardPlan[] memory plans =
            VoteSplitter.split(_powers(100), gauges, amounts, address(0), 30);

        assertEq(plans[0].gauges.length, 3);
        assertEq(_sum(plans[0].weights), 60);
    }

    function test_targetSpansTwoShards() public pure {
        (address[] memory gauges, uint256[] memory amounts) = _targets(50, 30, 20);
        VoteSplitter.ShardPlan[] memory plans =
            VoteSplitter.split(_powers(40, 60), gauges, amounts, address(0), 30);

        assertEq(plans[0].gauges.length, 1);
        assertEq(plans[0].gauges[0], G1);
        assertEq(plans[0].weights[0], 40);

        assertEq(plans[1].gauges.length, 3);
        assertEq(plans[1].gauges[0], G1);
        assertEq(plans[1].weights[0], 10);
        assertEq(plans[1].weights[1], 30);
        assertEq(plans[1].weights[2], 20);
    }

    function test_shardWithNothingLeftAbstainsEvenWithFallback() public pure {
        (address[] memory gauges, uint256[] memory amounts) = _targets(10, 0, 0);
        VoteSplitter.ShardPlan[] memory plans =
            VoteSplitter.split(_powers(10, 10), gauges, amounts, FALLBACK, 30);

        assertEq(plans[0].gauges.length, 1);
        assertEq(plans[0].gauges[0], G1);
        assertEq(plans[1].gauges.length, 0);
    }

    function test_shardWithNothingLeftAndNoFallbackIsEmpty() public pure {
        (address[] memory gauges, uint256[] memory amounts) = _targets(10, 0, 0);
        VoteSplitter.ShardPlan[] memory plans =
            VoteSplitter.split(_powers(10, 10), gauges, amounts, address(0), 30);

        assertEq(plans[1].gauges.length, 0);
    }

    function test_zeroAmountTargetsAreSkipped() public pure {
        (address[] memory gauges, uint256[] memory amounts) = _targets(0, 20, 0);
        VoteSplitter.ShardPlan[] memory plans =
            VoteSplitter.split(_powers(20), gauges, amounts, address(0), 30);

        assertEq(plans[0].gauges.length, 1);
        assertEq(plans[0].gauges[0], G2);
    }

    function test_maxGaugesPerShardIsRespected() public pure {
        uint256 n = 35;
        address[] memory gauges = new address[](n);
        uint256[] memory amounts = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            // forge-lint: disable-next-line(unsafe-typecast)
            gauges[i] = address(uint160(0x2000 + i));
            amounts[i] = 1;
        }
        VoteSplitter.ShardPlan[] memory plans =
            VoteSplitter.split(_powers(100, 100), gauges, amounts, address(0), 30);

        assertEq(plans[0].gauges.length, 30);
        assertEq(plans[1].gauges.length, 5);
    }

    function test_fallbackAlreadyInPlanMergesLeftover() public pure {
        address[] memory gauges = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        gauges[0] = G1;
        amounts[0] = 10;
        VoteSplitter.ShardPlan[] memory plans =
            VoteSplitter.split(_powers(25), gauges, amounts, G1, 30);

        assertEq(plans[0].gauges.length, 1);
        assertEq(plans[0].weights[0], 25);
    }

    function test_revertsOnZeroMaxGauges() public {
        (address[] memory gauges, uint256[] memory amounts) = _targets(1, 1, 1);
        vm.expectRevert(VoteSplitter.ZeroMaxGauges.selector);
        harness.split(_powers(10), gauges, amounts, address(0), 0);
    }

    function test_revertsOnLengthMismatch() public {
        address[] memory gauges = new address[](2);
        uint256[] memory amounts = new uint256[](1);
        vm.expectRevert(VoteSplitter.LengthMismatch.selector);
        harness.split(_powers(10), gauges, amounts, address(0), 30);
    }

    function testFuzz_targetsArePlacedExactlyWithinShardPower(uint256 seed) public pure {
        uint256 shards = 1 + (seed % 5);
        uint256 n = 1 + ((seed >> 8) % 12);
        uint256[] memory powers = new uint256[](shards);
        address[] memory gauges = new address[](n);
        uint256[] memory amounts = new uint256[](n);
        uint256 totalPower;
        for (uint256 i = 0; i < shards; i++) {
            powers[i] = 1 + uint256(keccak256(abi.encode(seed, "p", i))) % 1e24;
            totalPower += powers[i];
        }
        uint256 remaining = totalPower;
        for (uint256 i = 0; i < n; i++) {
            // forge-lint: disable-next-line(unsafe-typecast)
            gauges[i] = address(uint160(0x3000 + i));
            amounts[i] = uint256(keccak256(abi.encode(seed, "a", i))) % (remaining + 1);
            remaining -= amounts[i];
        }

        VoteSplitter.ShardPlan[] memory plans =
            VoteSplitter.split(powers, gauges, amounts, FALLBACK, 30);

        uint256 toTargets;
        for (uint256 k = 0; k < shards; k++) {
            assertEq(plans[k].gauges.length, plans[k].weights.length);
            assertLe(plans[k].gauges.length, 30);
            if (plans[k].gauges.length > 0) assertEq(_sum(plans[k].weights), powers[k]);
            for (uint256 j = 0; j < plans[k].gauges.length; j++) {
                if (plans[k].gauges[j] != FALLBACK) toTargets += plans[k].weights[j];
            }
        }
        assertEq(toTargets, _sum(amounts));
    }
}
