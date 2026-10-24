// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Epochs} from "../../src/libraries/Epochs.sol";

contract EpochsTest is Test {
    // Thursday 2026-10-22 00:00:00 UTC, an epoch boundary on Mezo.
    uint256 internal constant EPOCH = 1_792_627_200;

    function test_epochStart_floorsToThursday() public pure {
        assertEq(Epochs.epochStart(EPOCH), EPOCH);
        assertEq(Epochs.epochStart(EPOCH + 3 days + 5 hours), EPOCH);
        assertEq(Epochs.epochStart(EPOCH + 7 days), EPOCH + 7 days);
    }

    function test_voteWindow_isOneHourInFromBothEnds() public pure {
        assertEq(Epochs.voteStart(EPOCH + 2 days), EPOCH + 1 hours);
        assertEq(Epochs.voteEnd(EPOCH + 2 days), EPOCH + 7 days - 1 hours);
    }

    function test_inVoteWindow_boundaries() public pure {
        // NonStakingVoter: revert if ts <= epochVoteStart, revert if ts > epochVoteEnd.
        assertFalse(Epochs.inVoteWindow(EPOCH + 1 hours));
        assertTrue(Epochs.inVoteWindow(EPOCH + 1 hours + 1));
        assertTrue(Epochs.inVoteWindow(EPOCH + 7 days - 1 hours));
        assertFalse(Epochs.inVoteWindow(EPOCH + 7 days - 1 hours + 1));
    }

    function test_epochNext_isNextThursday() public pure {
        assertEq(Epochs.epochNext(EPOCH + 3 days), EPOCH + 7 days);
    }

    function testFuzz_epochStart_isWeekAligned(uint256 ts) public pure {
        ts = bound(ts, 0, type(uint64).max);
        uint256 start = Epochs.epochStart(ts);
        assertEq(start % 7 days, 0);
        assertLe(start, ts);
        assertLt(ts - start, 7 days);
    }
}
