// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {VeBtcAutopilot, IRelockableVe} from "../../src/autopilot/VeBtcAutopilot.sol";

interface IVeApprove {
    function ownerOf(uint256 tokenId) external view returns (address);
    function approve(address to, uint256 tokenId) external;
}

/// Runs against the live Mezo veBTC on a mainnet fork: MEZO_FORK=1 forge test --match-contract Fork
contract VeBtcAutopilotForkTest is Test {
    address constant VE_BTC = 0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279;
    uint256 constant TOKEN = 6180;

    function test_relocksRealVeBtcAfterAWeek() public {
        if (!vm.envOr("MEZO_FORK", false)) return;
        vm.createSelectFork("mezo");
        VeBtcAutopilot pilot = new VeBtcAutopilot(IRelockableVe(VE_BTC), 28 days);
        address owner = IVeApprove(VE_BTC).ownerOf(TOKEN);
        vm.prank(owner);
        IVeApprove(VE_BTC).approve(address(pilot), TOKEN);

        uint256 endBefore = IRelockableVe(VE_BTC).locked(TOKEN).end;
        vm.warp(block.timestamp + 1 weeks);
        assertTrue(pilot.canRelock(TOKEN));
        uint256[] memory ids = new uint256[](1);
        ids[0] = TOKEN;
        vm.prank(address(0xBEEF));
        assertEq(pilot.relock(ids), 1);

        uint256 endAfter = IRelockableVe(VE_BTC).locked(TOKEN).end;
        assertGt(endAfter, endBefore);
        assertLe(endAfter, block.timestamp + 28 days);
        assertEq(IVeApprove(VE_BTC).ownerOf(TOKEN), owner);
    }
}
