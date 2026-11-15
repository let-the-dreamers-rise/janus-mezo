// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Moves ownership of the vault and market behind a TimelockController.
///         The timelock starts with no delay so it can accept ownership right away, then a
///         batched call raises its own delay to FINAL_DELAY. After that every owner action
///         (fees, treasury, caps, market changes) waits FINAL_DELAY before it can execute.
library TimelockHandover {
    uint256 internal constant FINAL_DELAY = 48 hours;

    function deploy(address proposer) internal returns (TimelockController timelock) {
        address[] memory roles = new address[](1);
        roles[0] = proposer;
        // admin = address(0): the timelock administers itself, nobody can skip the delay.
        timelock = new TimelockController(0, roles, roles, address(0));
    }

    function acceptCalls(TimelockController timelock, address vault, address market)
        internal
        pure
        returns (address[] memory targets, uint256[] memory values, bytes[] memory payloads)
    {
        targets = new address[](3);
        values = new uint256[](3);
        payloads = new bytes[](3);
        targets[0] = vault;
        targets[1] = market;
        targets[2] = address(timelock);
        payloads[0] = abi.encodeCall(Ownable2Step.acceptOwnership, ());
        payloads[1] = abi.encodeCall(Ownable2Step.acceptOwnership, ());
        payloads[2] = abi.encodeCall(TimelockController.updateDelay, (FINAL_DELAY));
    }
}

contract TimelockScript is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address vault = vm.envAddress("JANUS_VAULT");
        address market = vm.envAddress("JANUS_MARKET");
        address deployer = vm.addr(key);

        vm.startBroadcast(key);
        TimelockController timelock = TimelockHandover.deploy(deployer);
        Ownable2Step(vault).transferOwnership(address(timelock));
        Ownable2Step(market).transferOwnership(address(timelock));
        (address[] memory t, uint256[] memory v, bytes[] memory p) =
            TimelockHandover.acceptCalls(timelock, vault, market);
        timelock.scheduleBatch(t, v, p, bytes32(0), bytes32(0), 0);
        timelock.executeBatch(t, v, p, bytes32(0), bytes32(0));
        vm.stopBroadcast();

        require(Ownable2Step(vault).owner() == address(timelock), "vault owner");
        require(Ownable2Step(market).owner() == address(timelock), "market owner");
        require(timelock.getMinDelay() == TimelockHandover.FINAL_DELAY, "delay");
        console2.log("timelock", address(timelock));
    }
}
