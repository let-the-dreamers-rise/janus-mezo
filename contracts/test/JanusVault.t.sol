// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {JanusVault} from "../src/JanusVault.sol";
import {IVotingEscrow} from "../src/interfaces/IVotingEscrow.sol";
import {IBoostVoter} from "../src/interfaces/IBoostVoter.sol";
import {MockVotingEscrow} from "./mocks/MockVotingEscrow.sol";
import {JanusFixture} from "./utils/JanusFixture.sol";

contract JanusVaultTest is JanusFixture {
    function _notify(uint256 amount) internal {
        musd.mint(address(market), amount);
        vm.startPrank(address(market));
        musd.approve(address(vault), amount);
        vault.notifyReward(amount);
        vm.stopPrank();
    }

    function _oneGauge(address gauge) internal pure returns (address[] memory g, uint256[] memory w) {
        g = new address[](1);
        w = new uint256[](1);
        g[0] = gauge;
        w[0] = 1;
    }

    // ---- construction ----

    function test_constructor_rejectsVoterOfAnotherEscrow() public {
        MockVotingEscrow other = new MockVotingEscrow(208 weeks);
        vm.expectRevert(JanusVault.VoterMismatch.selector);
        new JanusVault(
            IVotingEscrow(address(other)), IBoostVoter(address(voter)), IERC20(address(musd)), owner, 1e18
        );
    }

    function test_constructor_rejectsDustMinimum() public {
        vm.expectRevert(abi.encodeWithSelector(JanusVault.MinShardTooLow.selector, 1));
        new JanusVault(
            IVotingEscrow(address(veMezo)), IBoostVoter(address(voter)), IERC20(address(musd)), owner, 1
        );
    }

    function test_constructor_rejectsZeroAddresses() public {
        vm.expectRevert(JanusVault.ZeroAddress.selector);
        new JanusVault(IVotingEscrow(address(0)), IBoostVoter(address(voter)), IERC20(address(musd)), owner, 1e18);
    }

    // ---- deposits ----

    function test_deposit_mintsJMezoAndMakesLockPermanent() public {
        uint256 id = veMezo.mint(alice, 1_000e18, block.timestamp + 52 weeks, false);
        vm.prank(alice);
        veMezo.safeTransferFrom(alice, address(vault), id);

        assertEq(vault.balanceOf(alice), 1_000e18);
        assertEq(vault.totalSupply(), 1_000e18);
        assertEq(veMezo.ownerOf(id), address(vault));
        assertTrue(vault.isShard(id));
        assertEq(vault.shardAmount(id), 1_000e18);
        assertTrue(veMezo.locked(id).isPermanent);
    }

    function test_deposit_acceptsAlreadyPermanentLock() public {
        uint256 id = _depositShard(alice, 2_000e18);
        assertEq(vault.balanceOf(alice), 2_000e18);
        assertEq(vault.shardCount(), 1);
        assertEq(vault.shardIds()[0], id);
    }

    function test_deposit_creditsTheSenderNotTheOperator() public {
        uint256 id = veMezo.mint(alice, 1_000e18, 0, true);
        vm.prank(alice);
        veMezo.approve(bob, id);
        vm.prank(bob);
        veMezo.safeTransferFrom(alice, address(vault), id);
        assertEq(vault.balanceOf(alice), 1_000e18);
        assertEq(vault.balanceOf(bob), 0);
    }

    function test_deposit_rejectsCallsNotFromVeMezo() public {
        vm.expectRevert(JanusVault.NotVeMezo.selector);
        vault.onERC721Received(alice, alice, 1, "");
    }

    function test_deposit_rejectsManagedNft() public {
        uint256 id = veMezo.mint(alice, 1_000e18, 0, true);
        veMezo.setEscrowType(id, IVotingEscrow.EscrowType.MANAGED);
        vm.prank(alice);
        vm.expectRevert(JanusVault.UnsupportedEscrow.selector);
        veMezo.safeTransferFrom(alice, address(vault), id);
    }

    function test_deposit_rejectsUnvestedGrant() public {
        uint256 id = veMezo.mint(alice, 1_000e18, 0, true);
        veMezo.setVestingEnd(id, block.timestamp + 30 days);
        vm.prank(alice);
        vm.expectRevert(JanusVault.UnvestedGrant.selector);
        veMezo.safeTransferFrom(alice, address(vault), id);
    }

    function test_deposit_acceptsFullyVestedGrant() public {
        uint256 id = veMezo.mint(alice, 1_000e18, 0, true);
        veMezo.setVestingEnd(id, block.timestamp - 1);
        vm.prank(alice);
        veMezo.safeTransferFrom(alice, address(vault), id);
        assertTrue(vault.isShard(id));
    }

    function test_deposit_rejectsEmptyLock() public {
        uint256 id = veMezo.mint(alice, 0, 0, true);
        vm.prank(alice);
        vm.expectRevert(JanusVault.EmptyLock.selector);
        veMezo.safeTransferFrom(alice, address(vault), id);
    }

    function test_deposit_rejectsExpiredLock() public {
        uint256 id = veMezo.mint(alice, 1_000e18, block.timestamp, false);
        vm.prank(alice);
        vm.expectRevert(JanusVault.LockExpired.selector);
        veMezo.safeTransferFrom(alice, address(vault), id);
    }

    function test_deposit_rejectsDust() public {
        uint256 id = veMezo.mint(alice, 0.5e18, 0, true);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(JanusVault.ShardTooSmall.selector, 0.5e18, 1e18));
        veMezo.safeTransferFrom(alice, address(vault), id);
    }

    function test_deposit_rejectsWhenVaultIsFull() public {
        uint256 cap = vault.MAX_SHARDS();
        for (uint256 i = 0; i < cap; i++) {
            _depositShard(alice, 1e18);
        }
        uint256 id = veMezo.mint(alice, 1e18, 0, true);
        vm.prank(alice);
        vm.expectRevert(JanusVault.TooManyShards.selector);
        veMezo.safeTransferFrom(alice, address(vault), id);
    }

    // ---- redemptions ----

    function test_redeem_returnsNftAndBurnsJMezo() public {
        uint256 id = _depositShard(alice, 1_000e18);
        vm.prank(alice);
        vault.redeem(id);

        assertEq(veMezo.ownerOf(id), alice);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.totalSupply(), 0);
        assertFalse(vault.isShard(id));
        assertEq(vault.shardAmount(id), 0);
        assertTrue(veMezo.locked(id).isPermanent);
    }

    function test_redeem_anyShardWithEnoughJMezo() public {
        _depositShard(alice, 1_000e18);
        uint256 bobShard = _depositShard(bob, 500e18);
        vm.prank(alice);
        vault.redeem(bobShard);
        assertEq(veMezo.ownerOf(bobShard), alice);
        assertEq(vault.balanceOf(alice), 500e18);
        assertEq(vault.balanceOf(bob), 500e18);
    }

    function test_redeem_revertsWithoutEnoughJMezo() public {
        uint256 id = _depositShard(alice, 1_000e18);
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, bob, 0, 1_000e18)
        );
        vault.redeem(id);
    }

    function test_redeem_revertsForUnknownShard() public {
        vm.expectRevert(abi.encodeWithSelector(JanusVault.UnknownShard.selector, 42));
        vault.redeem(42);
    }

    function test_redeem_donatedMezoTravelsWithTheNft() public {
        uint256 id = _depositShard(alice, 1_000e18);
        veMezo.depositFor(id, 50e18);
        vm.prank(alice);
        vault.redeem(id);
        assertEq(veMezo.locked(id).amount, int128(1_050e18));
        assertEq(vault.totalSupply(), 0);
    }

    // ---- rewards ----

    function test_rewards_splitProRata() public {
        _depositShard(alice, 3_000e18);
        _depositShard(bob, 1_000e18);
        _notify(400e18);
        assertEq(vault.claimable(alice), 300e18);
        assertEq(vault.claimable(bob), 100e18);
        assertEq(vault.totalRewards(), 400e18);
    }

    function test_rewards_transfersOnlyMoveFutureRewards() public {
        _depositShard(alice, 1_000e18);
        _notify(100e18);
        vm.prank(alice);
        assertTrue(vault.transfer(bob, 500e18));
        _notify(100e18);
        assertEq(vault.claimable(alice), 150e18);
        assertEq(vault.claimable(bob), 50e18);
    }

    function test_rewards_lateDepositorEarnsNothingFromThePast() public {
        _depositShard(alice, 1_000e18);
        _notify(100e18);
        _depositShard(bob, 1_000e18);
        assertEq(vault.claimable(bob), 0);
        assertEq(vault.claimable(alice), 100e18);
    }

    function test_rewards_surviveRedemption() public {
        uint256 id = _depositShard(alice, 1_000e18);
        _depositShard(bob, 1_000e18);
        _notify(100e18);
        vm.prank(alice);
        vault.redeem(id);
        assertEq(vault.claimable(alice), 50e18);
    }

    function test_claim_paysOnce() public {
        _depositShard(alice, 1_000e18);
        _notify(100e18);
        vm.prank(alice);
        assertEq(vault.claim(), 100e18);
        assertEq(musd.balanceOf(alice), 100e18);
        vm.prank(alice);
        assertEq(vault.claim(), 0);
        assertEq(vault.claimable(alice), 0);
    }

    function test_notifyReward_onlyMarket() public {
        vm.expectRevert(JanusVault.NotMarket.selector);
        vault.notifyReward(1);
    }

    function test_notifyReward_revertsWithoutShares() public {
        vm.prank(address(market));
        vm.expectRevert(JanusVault.NoShares.selector);
        vault.notifyReward(1);
    }

    function test_notifyReward_zeroIsANoOp() public {
        _depositShard(alice, 1_000e18);
        vm.prank(address(market));
        vault.notifyReward(0);
        assertEq(vault.rewardPerShare(), 0);
    }

    function testFuzz_rewards_neverExceedWhatWasNotified(
        uint96 aliceAmount,
        uint96 bobAmount,
        uint96 moved,
        uint96 first,
        uint96 second
    ) public {
        uint256 a = bound(aliceAmount, 1e18, 1e27);
        uint256 b = bound(bobAmount, 1e18, 1e27);
        uint256 r1 = bound(first, 0, 1e27);
        uint256 r2 = bound(second, 0, 1e27);
        _depositShard(alice, a);
        _depositShard(bob, b);
        _notify(r1);
        vm.prank(alice);
        assertTrue(vault.transfer(bob, bound(moved, 0, a)));
        _notify(r2);

        // Each notification can lose less than supply / 1e24 wei to rounding, plus one
        // wei per holder when claims are computed.
        uint256 owed = vault.claimable(alice) + vault.claimable(bob);
        uint256 tolerance = 2 * ((a + b) / 1e24 + 1) + 2;
        assertLe(owed, r1 + r2);
        assertGe(owed + tolerance, r1 + r2);
    }

    // ---- market hooks ----

    function test_castVote_votesThroughBoostVoter() public {
        uint256 id = _depositShard(alice, 1_000e18);
        vm.roll(block.number + 1);
        address gauge = voter.createGauge();
        (address[] memory g, uint256[] memory w) = _oneGauge(gauge);

        vm.prank(address(market));
        vault.castVote(id, g, w);

        assertEq(voter.weights(gauge), 1_000e18);
        assertTrue(veMezo.voted(id));
    }

    function test_resetVote_clearsVotes() public {
        uint256 id = _depositShard(alice, 1_000e18);
        vm.roll(block.number + 1);
        address gauge = voter.createGauge();
        (address[] memory g, uint256[] memory w) = _oneGauge(gauge);
        vm.prank(address(market));
        vault.castVote(id, g, w);

        vm.warp(block.timestamp + 7 days);
        vm.prank(address(market));
        vault.resetVote(id);
        assertEq(voter.weights(gauge), 0);
        assertFalse(veMezo.voted(id));
    }

    function test_marketHooks_onlyMarket() public {
        (address[] memory g, uint256[] memory w) = _oneGauge(house);
        vm.expectRevert(JanusVault.NotMarket.selector);
        vault.castVote(1, g, w);
        vm.expectRevert(JanusVault.NotMarket.selector);
        vault.resetVote(1);
    }

    function test_marketHooks_rejectUnknownShards() public {
        (address[] memory g, uint256[] memory w) = _oneGauge(house);
        vm.startPrank(address(market));
        vm.expectRevert(abi.encodeWithSelector(JanusVault.UnknownShard.selector, 7));
        vault.castVote(7, g, w);
        vm.expectRevert(abi.encodeWithSelector(JanusVault.UnknownShard.selector, 7));
        vault.resetVote(7);
        vm.stopPrank();
    }

    // ---- views ----

    function test_totalVotingPower_hidesSharesInTheirTransferBlock() public {
        _depositShard(alice, 1_000e18);
        _depositShard(bob, 2_000e18);
        assertEq(vault.totalVotingPower(), 0);
        vm.roll(block.number + 1);
        assertEq(vault.totalVotingPower(), 3_000e18);
    }

    // ---- admin ----

    function test_setMarket_onlyOwnerAndNonZero() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        vault.setMarket(alice);

        vm.prank(owner);
        vm.expectRevert(JanusVault.ZeroAddress.selector);
        vault.setMarket(address(0));
    }

    function test_setMinShardAmount_respectsFloor() public {
        vm.startPrank(owner);
        vault.setMinShardAmount(5e18);
        assertEq(vault.minShardAmount(), 5e18);
        vm.expectRevert(abi.encodeWithSelector(JanusVault.MinShardTooLow.selector, 1e17));
        vault.setMinShardAmount(1e17);
        vm.stopPrank();
    }

    function test_recoverStrayNft_returnsNftSentWithoutHook() public {
        uint256 id = veMezo.mint(alice, 1_000e18, 0, true);
        vm.prank(alice);
        veMezo.transferFrom(alice, address(vault), id);
        assertEq(vault.balanceOf(alice), 0);

        vm.prank(owner);
        vault.recoverStrayNft(id, alice);
        assertEq(veMezo.ownerOf(id), alice);
    }

    function test_recoverStrayNft_cannotTouchShards() public {
        uint256 id = _depositShard(alice, 1_000e18);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(JanusVault.ShardIsRegistered.selector, id));
        vault.recoverStrayNft(id, owner);
    }
}
