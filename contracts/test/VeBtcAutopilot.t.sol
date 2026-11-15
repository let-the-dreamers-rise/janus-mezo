// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {VeBtcAutopilot, IRelockableVe} from "../src/autopilot/VeBtcAutopilot.sol";

/// Mirrors the Mezo Escrow.increaseUnlockTime rules that matter here.
contract MockVe is IRelockableVe {
    uint256 constant WEEK = 1 weeks;
    uint256 public immutable maxLockTime;
    mapping(uint256 => LockedBalance) internal _locked;
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => address) public getApproved;

    constructor(uint256 maxLockTime_) {
        maxLockTime = maxLockTime_;
    }

    function mint(uint256 id, address owner, uint256 end, bool permanent) external {
        ownerOf[id] = owner;
        _locked[id] = LockedBalance(1e18, end, permanent);
    }

    function approve(uint256 id, address to) external {
        require(msg.sender == ownerOf[id], "not owner");
        getApproved[id] = to;
    }

    function locked(uint256 id) external view returns (LockedBalance memory) {
        return _locked[id];
    }

    function isApprovedOrOwner(address spender, uint256 id) public view returns (bool) {
        return spender == ownerOf[id] || spender == getApproved[id];
    }

    function increaseUnlockTime(uint256 id, uint256 duration) external {
        require(isApprovedOrOwner(msg.sender, id), "NotApprovedOrOwner");
        LockedBalance memory old = _locked[id];
        require(!old.isPermanent, "PermanentLock");
        uint256 unlockTime = ((block.timestamp + duration) / WEEK) * WEEK;
        require(old.end > block.timestamp, "LockExpired");
        require(unlockTime > old.end, "LockDurationNotInFuture");
        require(unlockTime <= block.timestamp + maxLockTime, "LockDurationTooLong");
        _locked[id].end = unlockTime;
    }
}

contract VeBtcAutopilotTest is Test {
    uint256 constant MAX = 28 days;
    address constant HOLDER = address(0xA11CE);
    MockVe ve;
    VeBtcAutopilot pilot;

    function setUp() public {
        vm.warp(1_763_200_000);
        ve = new MockVe(MAX);
        pilot = new VeBtcAutopilot(ve, MAX);
        ve.mint(1, HOLDER, block.timestamp + 10 days, false);
    }

    function _ids(uint256 a) internal pure returns (uint256[] memory ids) {
        ids = new uint256[](1);
        ids[0] = a;
    }

    function _optIn(uint256 id) internal {
        vm.prank(HOLDER);
        ve.approve(id, address(pilot));
    }

    function test_relocksApprovedTokenToMaxTerm() public {
        _optIn(1);
        assertTrue(pilot.canRelock(1));
        assertEq(pilot.relock(_ids(1)), 1);
        assertEq(ve.locked(1).end, ((block.timestamp + MAX) / 1 weeks) * 1 weeks);
    }

    function test_anyoneCanTriggerRelock() public {
        _optIn(1);
        vm.prank(address(0xBEEF));
        assertEq(pilot.relock(_ids(1)), 1);
    }

    function test_skipsTokenWithoutApproval() public {
        assertFalse(pilot.canRelock(1));
        uint256 endBefore = ve.locked(1).end;
        assertEq(pilot.relock(_ids(1)), 0);
        assertEq(ve.locked(1).end, endBefore);
    }

    function test_skipsWhenAlreadyAtMaxThisWeek() public {
        _optIn(1);
        pilot.relock(_ids(1));
        assertFalse(pilot.canRelock(1));
        assertEq(pilot.relock(_ids(1)), 0);
    }

    function test_relocksAgainNextWeek() public {
        _optIn(1);
        pilot.relock(_ids(1));
        uint256 firstEnd = ve.locked(1).end;
        vm.warp(block.timestamp + 1 weeks);
        assertEq(pilot.relock(_ids(1)), 1);
        assertEq(ve.locked(1).end, firstEnd + 1 weeks);
    }

    function test_skipsPermanentAndExpiredLocks() public {
        ve.mint(2, HOLDER, block.timestamp + 10 days, true);
        ve.mint(3, HOLDER, block.timestamp + 1 days, false);
        _optIn(2);
        _optIn(3);
        vm.warp(block.timestamp + 2 days);
        assertFalse(pilot.canRelock(2));
        assertFalse(pilot.canRelock(3));
        uint256[] memory ids = new uint256[](2);
        ids[0] = 2;
        ids[1] = 3;
        assertEq(pilot.relock(ids), 0);
    }

    function test_optOutStopsRelock() public {
        _optIn(1);
        vm.prank(HOLDER);
        ve.approve(1, address(0));
        assertEq(pilot.relock(_ids(1)), 0);
    }

    function test_mixedBatchOnlyExtendsEligible() public {
        ve.mint(4, HOLDER, block.timestamp + 10 days, false);
        _optIn(1);
        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 4;
        assertEq(pilot.relock(ids), 1);
    }

    function test_constructorRejectsBadArgs() public {
        vm.expectRevert(VeBtcAutopilot.ZeroAddress.selector);
        new VeBtcAutopilot(IRelockableVe(address(0)), MAX);
        vm.expectRevert(VeBtcAutopilot.ZeroDuration.selector);
        new VeBtcAutopilot(ve, 1 days);
    }

    function testFuzz_neverExceedsMaxTerm(uint32 startOffset, uint32 elapsed) public {
        uint256 end = block.timestamp + 1 + (uint256(startOffset) % (MAX - 1));
        ve.mint(5, HOLDER, end, false);
        _optIn(5);
        vm.warp(block.timestamp + (uint256(elapsed) % MAX));
        pilot.relock(_ids(5));
        assertLe(ve.locked(5).end, block.timestamp + MAX);
    }
}
