// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {JanusVault} from "../../src/JanusVault.sol";
import {BoostMarket} from "../../src/BoostMarket.sol";
import {IVotingEscrow} from "../../src/interfaces/IVotingEscrow.sol";
import {IBoostVoter} from "../../src/interfaces/IBoostVoter.sol";
import {IJanusVault} from "../../src/interfaces/IJanusVault.sol";
import {MockVotingEscrow} from "../mocks/MockVotingEscrow.sol";
import {MockBoostVoter} from "../mocks/MockBoostVoter.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

/// @notice Shared world for Janus unit tests: Mezo test doubles, the vault, the market
///         and helpers for deposits, boostable veBTC NFTs, orders and full rounds.
/// @dev Totals are chosen so the boost math gives round numbers: with 1M veMEZO voting
///      power and 100 veBTC, a veBTC NFT of power p needs exactly p * 10,000 votes for 5x.
abstract contract JanusFixture is Test {
    /// @dev Thursday 2026-10-22 00:00:00 UTC, a Mezo epoch boundary.
    uint256 internal constant EPOCH = 1_792_627_200;
    uint256 internal constant VE_MEZO_TOTAL = 1_000_000e18;
    uint256 internal constant VE_BTC_TOTAL = 100e18;
    uint256 internal constant MIN_PRICE = 1e12;
    uint256 internal constant FEE_BPS = 1_000;

    MockVotingEscrow internal veMezo;
    MockVotingEscrow internal veBtc;
    MockBoostVoter internal voter;
    MockERC20 internal musd;
    JanusVault internal vault;
    BoostMarket internal market;
    address internal house;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave");
    address internal keeper = makeAddr("keeper");

    function setUp() public virtual {
        vm.warp(EPOCH + 1 days);

        veMezo = new MockVotingEscrow(208 weeks);
        veBtc = new MockVotingEscrow(28 days);
        voter = new MockBoostVoter(address(veMezo), address(veBtc));
        veMezo.setVoter(address(voter));
        veBtc.setBooster(address(voter));
        veMezo.setTotals(VE_MEZO_TOTAL, VE_MEZO_TOTAL);
        veBtc.setTotals(VE_BTC_TOTAL, VE_BTC_TOTAL);
        musd = new MockERC20("Mezo USD", "MUSD");

        vault = new JanusVault(
            IVotingEscrow(address(veMezo)),
            IBoostVoter(address(voter)),
            IERC20(address(musd)),
            owner,
            1e18
        );
        market = new BoostMarket(
            BoostMarket.Config({
                vault: IJanusVault(address(vault)),
                boostVoter: IBoostVoter(address(voter)),
                veMezo: IVotingEscrow(address(veMezo)),
                veBtc: IVotingEscrow(address(veBtc)),
                musd: IERC20(address(musd)),
                treasury: treasury,
                owner: owner,
                minPricePerVote: MIN_PRICE,
                feeBps: FEE_BPS
            })
        );
        house = voter.createGauge();

        vm.startPrank(owner);
        vault.setMarket(address(market));
        market.setFallbackGauge(house);
        vm.stopPrank();
    }

    function _depositShard(address who, uint256 amount) internal returns (uint256 id) {
        id = veMezo.mint(who, amount, 0, true);
        vm.prank(who);
        veMezo.safeTransferFrom(who, address(vault), id);
    }

    function _boostable(address who, uint256 power) internal returns (uint256 id, address gauge) {
        id = veBtc.mint(who, power, 0, true);
        vm.prank(who);
        gauge = voter.createBoostGauge(address(0), id, new address[](0), new uint256[](0));
    }

    function _placeOrder(address who, uint256 tokenId, uint256 price, uint256 target, uint256 escrow)
        internal
        returns (uint256 orderId)
    {
        musd.mint(who, escrow);
        vm.startPrank(who);
        musd.approve(address(market), escrow);
        orderId = market.placeOrder(tokenId, price, target, escrow);
        vm.stopPrank();
    }

    function _runRound() internal {
        vm.roll(block.number + 1);
        vm.startPrank(keeper);
        market.startRound();
        market.resetShards(type(uint256).max);
        market.settle();
        market.castVotes(type(uint256).max);
        market.finalize();
        vm.stopPrank();
    }

    function _phase() internal view returns (BoostMarket.Phase) {
        (, BoostMarket.Round memory info) = market.currentRound();
        return info.phase;
    }
}
