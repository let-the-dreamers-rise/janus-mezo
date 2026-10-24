// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {JanusVault} from "../../src/JanusVault.sol";
import {BoostMarket} from "../../src/BoostMarket.sol";
import {IVotingEscrow} from "../../src/interfaces/IVotingEscrow.sol";
import {IBoostVoter} from "../../src/interfaces/IBoostVoter.sol";
import {IJanusVault} from "../../src/interfaces/IJanusVault.sol";
import {BoostMath} from "../../src/libraries/BoostMath.sol";
import {Epochs} from "../../src/libraries/Epochs.sol";

/// @notice Runs Janus against the live Mezo matsnet contracts on a fork: real veMEZO, veBTC,
///         BoostVoter and MUSD, using real NFTs by pranking their owners.
/// @dev Opt in with FORK_MATSNET=true and run with --isolate, so every top-level call is its
///      own transaction with cold storage, metered as matsnet would charge it. The NFTs come
///      from test/fork/data/matsnet-nfts.json (keeper: pnpm scan:nfts), which also pins the
///      fork block so runs are reproducible and Foundry can cache the RPC reads.
contract MatsnetForkTest is Test {
    IBoostVoter internal constant VOTER = IBoostVoter(0x21d7bDF5a5929AD179F8cA0c9014A0B62ae6Bfd1);
    IVotingEscrow internal constant VE_MEZO =
        IVotingEscrow(0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b);
    IVotingEscrow internal constant VE_BTC =
        IVotingEscrow(0x38E35d92E6Bfc6787272A62345856B13eA12130a);
    IERC20 internal constant MUSD = IERC20(0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503);
    string internal constant NFT_DATA = "test/fork/data/matsnet-nfts.json";
    uint256 internal constant PRICE = 1e15;
    /// @dev Matsnet blocks carry 10M gas; every step must leave a fifth of that spare.
    uint256 internal constant STEP_GAS_BUDGET = 8_000_000;

    bool internal enabled;
    string internal data;
    JanusVault internal vault;
    BoostMarket internal market;
    address internal owner = makeAddr("janus-owner");
    address internal treasury = makeAddr("janus-treasury");

    /// @dev Real NFTs from the snapshot, strongest veMEZO first.
    uint256[] internal veMezoIds;
    address[] internal veMezoOwners;
    bool[] internal veMezoHasVotes;
    uint256[] internal veBtcIds;
    address[] internal veBtcOwners;
    address[] internal veBtcGauges;

    uint256 internal worstStep;

    modifier onlyFork() {
        if (!enabled) {
            vm.skip(true);
            return;
        }
        _;
    }

    function setUp() public {
        enabled = vm.envOr("FORK_MATSNET", false) && vm.isFile(NFT_DATA);
        if (!enabled) return;
        data = vm.readFile(NFT_DATA);
        vm.createSelectFork(vm.rpcUrl("matsnet"), vm.parseJsonUint(data, ".block"));
        veMezoIds = vm.parseJsonUintArray(data, ".veMezoIds");
        veMezoOwners = vm.parseJsonAddressArray(data, ".veMezoOwners");
        veMezoHasVotes = vm.parseJsonBoolArray(data, ".veMezoHasVotes");
        veBtcIds = vm.parseJsonUintArray(data, ".veBtcIds");
        veBtcOwners = vm.parseJsonAddressArray(data, ".veBtcOwners");
        veBtcGauges = vm.parseJsonAddressArray(data, ".veBtcGauges");

        vault = new JanusVault(VE_MEZO, VOTER, MUSD, owner, 1e18);
        market = new BoostMarket(
            BoostMarket.Config({
                vault: IJanusVault(address(vault)),
                boostVoter: VOTER,
                veMezo: VE_MEZO,
                veBtc: VE_BTC,
                musd: MUSD,
                treasury: treasury,
                owner: owner,
                minPricePerVote: 1e9,
                feeBps: 1_000
            })
        );
        vm.startPrank(owner);
        vault.setMarket(address(market));
        market.setFallbackGauge(veBtcGauges[veBtcGauges.length - 1]);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Correctness against the real contracts
    // ------------------------------------------------------------------

    function test_fork_fullRoundBoostsARealVeBtcNft() public onlyFork {
        assertTrue(Epochs.inVoteWindow(block.timestamp), "fork block is outside the vote window");
        uint256 shard = veMezoIds[0];
        address depositor = veMezoOwners[0];
        this.depositAs(depositor, shard);
        assertEq(VE_MEZO.ownerOf(shard), address(vault));
        assertTrue(VE_MEZO.locked(shard).isPermanent);
        vm.roll(block.number + 1);

        uint256 buyerNft = veBtcIds[0];
        address buyerGauge = veBtcGauges[0];
        market.startRound();
        market.resetShards(10);
        uint256 base = VOTER.weights(buyerGauge);
        uint256 expectedFill = Math.min(market.quoteVotes(buyerNft, 5e18), VE_MEZO.votingPowerOfNFT(shard));
        uint256 orderId = _placeOrderFor(veBtcOwners[0], buyerNft, PRICE, 5e18, (expectedFill * PRICE) / 1e18 + 1e18);
        uint256 escrowBefore = market.getOrder(orderId).escrow;

        market.settle();
        market.castVotes(10);
        uint256 appliedBefore = VE_BTC.locked(buyerNft).boost;
        market.finalize();
        assertEq(VE_BTC.locked(buyerNft).boost, appliedBefore, "finalize does not poke");

        (, uint256 filled,, uint256 charged) = market.fills(1, orderId);
        assertEq(filled, expectedFill, "fill");
        assertEq(VOTER.weights(buyerGauge), base + filled, "gauge weight");
        assertEq(charged, Math.mulDiv(filled, PRICE, 1e18, Math.Rounding.Ceil), "charge");
        assertEq(market.getOrder(orderId).escrow, escrowBefore - charged, "escrow");
        assertApproxEqAbs(vault.claimable(depositor), charged - (charged * 1_000) / 10_000, 1);

        uint256 predicted = BoostMath.boostOf(
            VE_MEZO.totalVotingPower(),
            VE_BTC.unboostedTotalVotingPower(),
            VE_BTC.unboostedVotingPowerOfNFT(buyerNft),
            VOTER.weights(buyerGauge)
        );
        assertEq(VOTER.getBoost(buyerNft), predicted, "BoostMath mirrors BoostVoter");
        VOTER.pokeBoost(buyerNft);
        assertEq(VE_BTC.locked(buyerNft).boost, predicted, "the keeper's poke applies the boost");
        console2.log("filled votes", filled, "boost after round", predicted);
    }

    function test_fork_everyCandidateDeposits() public onlyFork {
        uint256 n = _depositAll(vault.MAX_SHARDS());
        assertEq(n, Math.min(veMezoIds.length, vault.MAX_SHARDS()), "some veMEZO NFTs were rejected");
        assertEq(vault.shardCount(), n);
    }

    // ------------------------------------------------------------------
    // Gas profile
    // ------------------------------------------------------------------

    /// @dev Meters the costs that bound a round: one BoostVoter vote and reset per gauge, one
    ///      boost poke, and every market step on up to MAX_SHARDS real shards.
    function test_fork_gasProfile() public onlyFork {
        _depositAll(vault.MAX_SHARDS());
        vm.roll(block.number + 1);
        (uint256 single, uint256 wide) = _twoFreshShards();
        uint256 gauges = veBtcGauges.length - 1;

        VOTER.pokeBoost(veBtcIds[0]);
        uint256 poke = _meter("pokeBoost, one veBTC NFT");
        uint256 vote1 = _castAsMarket(single, 1);
        uint256 voteN = _castAsMarket(wide, gauges);
        uint256 perVote = (voteN - vote1) / (gauges - 1);
        console2.log("vote, gauges", gauges, "gas per extra gauge", perVote);

        vm.warp(block.timestamp + 1 weeks);
        vm.roll(block.number + 1);
        vm.prank(address(market));
        vault.resetVote(single);
        uint256 reset1 = _meter("reset, 1 gauge");
        vm.prank(address(market));
        vault.resetVote(wide);
        uint256 resetN = _meter("reset, many gauges");
        uint256 perReset = (resetN - reset1) / (gauges - 1);

        uint256 maxGauges = VOTER.maxVotingNum();
        console2.log("extrapolated vote, maxVotingNum gauges", vote1 + (maxGauges - 1) * perVote);
        console2.log("extrapolated reset, maxVotingNum gauges", reset1 + (maxGauges - 1) * perReset);
        console2.log("extrapolated pokes, MAX_ACTIVE_ORDERS fills", poke * market.MAX_ACTIVE_ORDERS());

        _meteredRound();
        assertLt(worstStep, STEP_GAS_BUDGET, "a market step exceeds the block budget");
    }

    function _meteredRound() internal {
        uint256 orders = Math.min(veBtcIds.length - 1, market.MAX_ACTIVE_ORDERS());
        for (uint256 i = 0; i < orders; i++) {
            _placeOrderFor(veBtcOwners[i], veBtcIds[i], PRICE + i * 1e12, 5e18, 10e18);
        }
        market.startRound();
        _meter("startRound");
        while (_phase() == BoostMarket.Phase.Resetting) {
            market.resetShards(10);
            _meter("resetShards(10)");
        }
        market.settle();
        _meter("settle");
        while (_phase() == BoostMarket.Phase.Voting) {
            market.castVotes(5);
            _meter("castVotes(5)");
        }
        market.finalize();
        _meter("finalize");
        uint256[] memory filled = market.roundOrders(market.roundId());
        console2.log("orders", orders, "filled", filled.length);
        _meterBatchedPokes(filled);
    }

    /// @dev What the keeper sends after finalize: one pokeBoosts for every filled NFT.
    function _meterBatchedPokes(uint256[] memory orderIds) internal {
        if (orderIds.length == 0) return;
        uint256[] memory nfts = new uint256[](orderIds.length);
        for (uint256 i = 0; i < orderIds.length; i++) {
            nfts[i] = market.getOrder(orderIds[i]).tokenId;
        }
        VOTER.pokeBoosts(nfts);
        uint256 batch = _meter("pokeBoosts, every filled NFT");
        console2.log("gas per batched poke", batch / nfts.length);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /// @dev External so a failed deposit can be caught and reported instead of ending the test.
    function depositAs(address holder, uint256 tokenId) external {
        vm.prank(holder);
        VE_MEZO.safeTransferFrom(holder, address(vault), tokenId);
    }

    function _depositAll(uint256 max) internal returns (uint256 n) {
        uint256 count = Math.min(veMezoIds.length, max);
        for (uint256 i = 0; i < count; i++) {
            try this.depositAs(veMezoOwners[i], veMezoIds[i]) {
                n++;
            } catch (bytes memory reason) {
                console2.log("rejected veMEZO", veMezoIds[i], veMezoHasVotes[i] ? "has votes" : "no votes");
                console2.logBytes(reason);
            }
        }
        console2.log("deposited shards", n, "of", count);
    }

    /// @dev Two vault shards that carry no votes, so a vote measures only its own cost.
    function _twoFreshShards() internal view returns (uint256 single, uint256 wide) {
        for (uint256 i = 0; i < veMezoIds.length && wide == 0; i++) {
            if (veMezoHasVotes[i] || !vault.isShard(veMezoIds[i])) continue;
            if (single == 0) single = veMezoIds[i];
            else wide = veMezoIds[i];
        }
        require(wide != 0, "need two shards without votes");
    }

    function _castAsMarket(uint256 shard, uint256 count) internal returns (uint256) {
        address[] memory gauges = new address[](count);
        uint256[] memory weights = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            gauges[i] = veBtcGauges[i];
            weights[i] = 1;
        }
        vm.prank(address(market));
        vault.castVote(shard, gauges, weights);
        return _meter(count == 1 ? "vote, 1 gauge" : "vote, many gauges");
    }

    /// @dev Reads only gasTotalUsed. This forge-std declares Vm.Gas with a state-gas field
    ///      that forge 1.7 does not return, so decoding the whole struct would revert.
    function _meter(string memory step) internal returns (uint256 used) {
        (bool ok, bytes memory ret) = address(vm).staticcall(abi.encodeWithSignature("lastCallGas()"));
        require(ok && ret.length >= 64, "lastCallGas failed");
        (, used) = abi.decode(ret, (uint256, uint256));
        console2.log(step, used);
        if (used > worstStep) worstStep = used;
    }

    function _phase() internal view returns (BoostMarket.Phase) {
        (, BoostMarket.Round memory info) = market.currentRound();
        return info.phase;
    }

    function _placeOrderFor(address who, uint256 nft, uint256 price, uint256 target, uint256 escrow)
        internal
        returns (uint256 orderId)
    {
        deal(address(MUSD), who, escrow);
        vm.startPrank(who);
        MUSD.approve(address(market), escrow);
        orderId = market.placeOrder(nft, price, target, escrow);
        vm.stopPrank();
    }
}
