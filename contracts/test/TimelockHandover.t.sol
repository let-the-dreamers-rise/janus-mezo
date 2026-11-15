// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {TimelockHandover} from "../script/Timelock.s.sol";

contract Owned is Ownable2Step {
    uint256 public fee;

    constructor(address owner_) Ownable(owner_) {}

    function setFee(uint256 fee_) external onlyOwner {
        fee = fee_;
    }
}

contract TimelockHandoverTest is Test {
    Owned vault;
    Owned market;
    TimelockController timelock;

    function setUp() public {
        // A real clock: the timelock reads timestamp 1 as "done".
        vm.warp(1_763_200_000);
        vault = new Owned(address(this));
        market = new Owned(address(this));
        timelock = TimelockHandover.deploy(address(this));
        vault.transferOwnership(address(timelock));
        market.transferOwnership(address(timelock));
        (address[] memory t, uint256[] memory v, bytes[] memory p) =
            TimelockHandover.acceptCalls(timelock, address(vault), address(market));
        timelock.scheduleBatch(t, v, p, bytes32(0), bytes32(0), 0);
        timelock.executeBatch(t, v, p, bytes32(0), bytes32(0));
    }

    function test_timelockOwnsBothAndDelayIs48h() public view {
        assertEq(vault.owner(), address(timelock));
        assertEq(market.owner(), address(timelock));
        assertEq(timelock.getMinDelay(), 48 hours);
    }

    function test_formerOwnerCannotActDirectly() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this)));
        vault.setFee(1);
    }

    function test_ownerActionWaits48h() public {
        bytes memory call = abi.encodeCall(Owned.setFee, (7));
        vm.expectRevert();
        timelock.schedule(address(market), 0, call, bytes32(0), bytes32("a"), 1 hours);

        timelock.schedule(address(market), 0, call, bytes32(0), bytes32("a"), 48 hours);
        vm.expectRevert();
        timelock.execute(address(market), 0, call, bytes32(0), bytes32("a"));

        vm.warp(block.timestamp + 48 hours);
        timelock.execute(address(market), 0, call, bytes32(0), bytes32("a"));
        assertEq(market.fee(), 7);
    }

    function test_strangerCannotSchedule() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        timelock.schedule(address(market), 0, "", bytes32(0), bytes32("b"), 48 hours);
    }
}
