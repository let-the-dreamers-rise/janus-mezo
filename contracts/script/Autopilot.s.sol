// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {VeBtcAutopilot, IRelockableVe} from "../src/autopilot/VeBtcAutopilot.sol";

/// Deploys VeBtcAutopilot for the veBTC named by VE_BTC with Mezo's 28-day maximum term.
contract AutopilotScript is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address veBtc = vm.envAddress("VE_BTC");
        vm.startBroadcast(key);
        VeBtcAutopilot pilot = new VeBtcAutopilot(IRelockableVe(veBtc), 28 days);
        vm.stopBroadcast();
        console2.log("autopilot", address(pilot));
    }
}
