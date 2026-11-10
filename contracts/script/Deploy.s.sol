// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {JanusVault} from "../src/JanusVault.sol";
import {BoostMarket} from "../src/BoostMarket.sol";
import {IVotingEscrow} from "../src/interfaces/IVotingEscrow.sol";
import {IBoostVoter} from "../src/interfaces/IBoostVoter.sol";
import {IJanusVault} from "../src/interfaces/IJanusVault.sol";

/// @notice Deploys JanusVault and BoostMarket against Mezo's live contracts and writes the
///         addresses to deployments/<chainId>.json.
/// @dev forge script script/Deploy.s.sol --rpc-url matsnet --broadcast
///      Reads DEPLOYER_PRIVATE_KEY from the environment and never logs it. The house
///      fallback gauge is set afterwards, once the treasury's veBTC NFT has a gauge.
contract Deploy is Script {
    struct MezoAddresses {
        address boostVoter;
        address veMezo;
        address veBtc;
        address musd;
    }

    struct LaunchSettings {
        address treasury;
        uint256 depositCap;
    }

    uint256 internal constant MEZO_MAINNET = 31612;
    uint256 internal constant MIN_SHARD_AMOUNT = 1e18;
    uint256 internal constant MIN_PRICE_PER_VOTE = 1e12;
    uint256 internal constant FEE_BPS = 1_000;

    function run() external returns (JanusVault vault, BoostMarket market) {
        MezoAddresses memory mezo = mezoAddresses(block.chainid);
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(key);
        LaunchSettings memory settings = launchSettings(
            block.chainid,
            deployer,
            vm.envOr("JANUS_TREASURY", address(0)),
            vm.envOr("JANUS_DEPOSIT_CAP", uint256(0))
        );
        address treasury = settings.treasury;

        vm.startBroadcast(key);
        vault = new JanusVault(
            IVotingEscrow(mezo.veMezo),
            IBoostVoter(mezo.boostVoter),
            IERC20(mezo.musd),
            deployer,
            MIN_SHARD_AMOUNT
        );
        market = new BoostMarket(
            BoostMarket.Config({
                vault: IJanusVault(address(vault)),
                boostVoter: IBoostVoter(mezo.boostVoter),
                veMezo: IVotingEscrow(mezo.veMezo),
                veBtc: IVotingEscrow(mezo.veBtc),
                musd: IERC20(mezo.musd),
                treasury: treasury,
                owner: deployer,
                minPricePerVote: MIN_PRICE_PER_VOTE,
                feeBps: FEE_BPS
            })
        );
        vault.setMarket(address(market));
        if (settings.depositCap != type(uint256).max) vault.setDepositCap(settings.depositCap);
        vm.stopBroadcast();

        _record(vault, market, mezo, deployer, treasury);
        console2.log("JanusVault", address(vault));
        console2.log("BoostMarket", address(market));
    }

    /// @notice Mainnet must name a treasury and a deposit cap, so a launch is never uncapped
    ///         by accident. Pass zero for an unset value; testnets fall back to open defaults.
    function launchSettings(uint256 chainId, address deployer, address treasury, uint256 cap)
        public
        pure
        returns (LaunchSettings memory)
    {
        if (chainId == MEZO_MAINNET) {
            require(treasury != address(0), "Deploy: mainnet needs JANUS_TREASURY");
            require(cap != 0, "Deploy: mainnet needs JANUS_DEPOSIT_CAP");
        }
        return LaunchSettings({
            treasury: treasury == address(0) ? deployer : treasury,
            depositCap: cap == 0 ? type(uint256).max : cap
        });
    }

    /// @notice Mezo contract addresses per chain: 31611 is matsnet, 31612 is mainnet.
    function mezoAddresses(uint256 chainId) public pure returns (MezoAddresses memory) {
        if (chainId == 31611) {
            return MezoAddresses({
                boostVoter: 0x21d7bDF5a5929AD179F8cA0c9014A0B62ae6Bfd1,
                veMezo: 0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b,
                veBtc: 0x38E35d92E6Bfc6787272A62345856B13eA12130a,
                musd: 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
            });
        }
        if (chainId == 31612) {
            return MezoAddresses({
                boostVoter: 0x2Ba614a598Cffa5a19d683cDCA97bac3a49313d1,
                veMezo: 0xb90fdAd3DFD180458D62Cc6acedc983D78E20122,
                veBtc: 0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279,
                musd: 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186
            });
        }
        revert("Deploy: unsupported chain");
    }

    function _record(
        JanusVault vault,
        BoostMarket market,
        MezoAddresses memory mezo,
        address deployer,
        address treasury
    ) internal {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeUint(key, "deployedAtBlock", block.number);
        vm.serializeAddress(key, "vault", address(vault));
        vm.serializeAddress(key, "market", address(market));
        vm.serializeAddress(key, "owner", deployer);
        vm.serializeAddress(key, "treasury", treasury);
        vm.serializeAddress(key, "boostVoter", mezo.boostVoter);
        vm.serializeAddress(key, "veMezo", mezo.veMezo);
        vm.serializeAddress(key, "veBtc", mezo.veBtc);
        string memory json = vm.serializeAddress(key, "musd", mezo.musd);
        vm.writeJson(json, string.concat("deployments/", vm.toString(block.chainid), ".json"));
    }
}
