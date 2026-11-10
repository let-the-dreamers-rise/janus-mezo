// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {IBoostVoter} from "../src/interfaces/IBoostVoter.sol";

contract DeployAddressesTest is Test {
    Deploy internal deploy = new Deploy();

    function test_mainnet_usesTheVeBtcBoostVoterBoosts() public view {
        assertEq(deploy.mezoAddresses(31612).veBtc, 0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279);
    }

    function test_unknownChain_reverts() public {
        vm.expectRevert(bytes("Deploy: unsupported chain"));
        deploy.mezoAddresses(1);
    }

    function test_mainnet_refusesToLaunchWithoutAnExplicitTreasury() public {
        vm.expectRevert(bytes("Deploy: mainnet needs JANUS_TREASURY"));
        deploy.launchSettings(31612, address(this), address(0), 1_000e18);
    }

    function test_mainnet_refusesToLaunchUncapped() public {
        vm.expectRevert(bytes("Deploy: mainnet needs JANUS_DEPOSIT_CAP"));
        deploy.launchSettings(31612, address(this), address(0xBEEF), 0);
    }

    function test_mainnet_usesTheGivenTreasuryAndCap() public view {
        Deploy.LaunchSettings memory settings = deploy.launchSettings(31612, address(this), address(0xBEEF), 1_000e18);
        assertEq(settings.treasury, address(0xBEEF));
        assertEq(settings.depositCap, 1_000e18);
    }

    function test_testnet_defaultsToTheDeployerAndNoCap() public view {
        Deploy.LaunchSettings memory settings = deploy.launchSettings(31611, address(this), address(0), 0);
        assertEq(settings.treasury, address(this));
        assertEq(settings.depositCap, type(uint256).max);
    }

    /// @dev Runs only with MEZO_MAINNET_RPC set; proves the constructor's VoterMismatch cannot fire.
    function test_fork_mainnetAddressesMatchTheLiveVoter() public {
        string memory rpc = vm.envOr("MEZO_MAINNET_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        Deploy.MezoAddresses memory mezo = deploy.mezoAddresses(31612);
        vm.createSelectFork(rpc);
        assertEq(IBoostVoter(mezo.boostVoter).ve(), mezo.veMezo);
        assertEq(IBoostVoter(mezo.boostVoter).boostableVe(), mezo.veBtc);
    }
}
