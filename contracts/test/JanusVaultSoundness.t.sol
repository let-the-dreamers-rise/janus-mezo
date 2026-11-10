// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {JanusFixture} from "./utils/JanusFixture.sol";
import {JanusVault} from "../src/JanusVault.sol";
import {JanusRewards} from "../src/vault/JanusRewards.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice Wave 2 soundness: jMEZO is a fungible share of all locked MEZO, rewards stream so
///         nobody can buy in just before a payout, liquidity pools are excluded from rewards,
///         and bribes the shards earn reach holders.
contract BrokenToken is MockERC20 {
    bool public broken;

    constructor() MockERC20("Broken", "BRK") {}

    function setBroken(bool value) external {
        broken = value;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        require(!broken, "broken");
        return super.transfer(to, value);
    }

    function balanceOf(address account) public view override returns (uint256) {
        require(!broken, "broken");
        return super.balanceOf(account);
    }
}

contract JanusVaultSoundnessTest is JanusFixture {
    uint256 internal constant STREAM = 7 days;

    // ---- review fixes ----

    function _brokenTokenStreamedTo() internal returns (BrokenToken token) {
        token = new BrokenToken();
        vm.prank(owner);
        vault.addRewardToken(address(token));
        token.mint(address(vault), 10e18);
        vault.syncRewards();
        _notify(7e18);
        skip(STREAM);
        token.setBroken(true);
    }

    function test_claimToken_paysMusdWhenAnotherRewardTokenIsBroken() public {
        _depositShard(alice, 100e18);
        _brokenTokenStreamedTo();

        vm.prank(alice);
        vm.expectRevert();
        vault.claim();

        vm.prank(alice);
        uint256 paid = vault.claimToken(address(musd));
        assertApproxEqAbs(paid, 7e18, 1e6);
        assertEq(musd.balanceOf(alice), paid);
    }

    function test_syncRewards_skipsATokenThatCannotBeRead() public {
        _depositShard(alice, 100e18);
        _brokenTokenStreamedTo();
        vault.syncRewards();
    }

    function test_exclude_refusesAnAccountWithUnclaimedRewards() public {
        _depositShard(alice, 100e18);
        _notify(7e18);
        skip(STREAM);
        vm.startPrank(alice);
        vault.transfer(bob, vault.balanceOf(alice));
        vm.stopPrank();

        vm.prank(owner);
        vm.expectRevert(JanusRewards.HasUnclaimedRewards.selector);
        vault.excludeFromRewards(alice);
    }

    function test_claimable_isZeroForAnExcludedAccountThatClaimedBefore() public {
        _depositShard(alice, 100e18);
        _notify(7e18);
        skip(STREAM);
        vm.startPrank(alice);
        vault.claim();
        vault.transfer(bob, vault.balanceOf(alice));
        vm.stopPrank();

        vm.prank(owner);
        vault.excludeFromRewards(alice);
        assertEq(vault.claimable(alice), 0);
    }

    function test_deposit_refusesToMintZeroShares() public {
        uint256 first = _depositShard(alice, 1e18);
        veMezo.depositFor(first, 1e37);
        uint256 tiny = veMezo.mint(bob, 1e18, 0, true);

        vm.prank(bob);
        vm.expectRevert(JanusVault.NoShares.selector);
        veMezo.safeTransferFrom(bob, address(vault), tiny);
    }

    function test_redeem_blockedFromResetUntilVotesAreCast() public {
        uint256 id = _depositShard(alice, 100e18);
        vm.roll(block.number + 1);
        market.startRound();

        vm.prank(alice);
        vm.expectRevert(JanusVault.RoundInProgress.selector);
        vault.redeem(id);

        market.resetShards(type(uint256).max);
        market.settle();
        vm.prank(alice);
        vm.expectRevert(JanusVault.RoundInProgress.selector);
        vault.redeem(id);

        market.castVotes(type(uint256).max);
        _pokeIfNeeded();
        market.finalize();
        vm.prank(alice);
        vault.redeem(id);
        assertEq(veMezo.ownerOf(id), alice);
    }

    function _notify(uint256 amount) internal {
        musd.mint(address(market), amount);
        vm.startPrank(address(market));
        musd.approve(address(vault), amount);
        vault.notifyReward(amount);
        vm.stopPrank();
    }

    // ---- shares ----

    function test_shares_firstDepositMintsOneToOne() public {
        _depositShard(alice, 100e18);
        assertEq(vault.balanceOf(alice), 100e18);
    }

    function test_shares_growthAccruesToEveryHolder() public {
        uint256 first = _depositShard(alice, 100e18);
        veMezo.depositFor(first, 100e18);
        assertEq(vault.totalLocked(), 200e18);

        _depositShard(bob, 100e18);
        assertEq(vault.balanceOf(bob), 50e18, "later deposit buys in at the grown value");
    }

    function test_redeem_costsTheShardsCurrentShareOfTheVault() public {
        uint256 first = _depositShard(alice, 100e18);
        _depositShard(alice, 100e18);
        _depositShard(bob, 100e18);
        veMezo.depositFor(first, 100e18);

        assertEq(vault.redeemCost(first), 150e18, "200 of 400 MEZO costs half of the 300 jMEZO");
        vm.prank(alice);
        vault.redeem(first);
        assertEq(vault.balanceOf(alice), 50e18);
        assertEq(veMezo.ownerOf(first), alice);
    }

    function test_redeem_cannotExtractDonatedMezoForFree() public {
        uint256 first = _depositShard(alice, 100e18);
        _depositShard(bob, 100e18);
        veMezo.depositFor(first, 1_000e18);

        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(first);
    }

    function test_shardAmount_tracksTheLock() public {
        uint256 id = _depositShard(alice, 100e18);
        veMezo.depositFor(id, 5e18);
        assertEq(vault.shardAmount(id), 105e18);
    }

    function test_depositCap_blocksDepositsOverIt() public {
        vm.prank(owner);
        vault.setDepositCap(150e18);
        _depositShard(alice, 100e18);

        uint256 id = veMezo.mint(bob, 100e18, 0, true);
        vm.prank(bob);
        vm.expectRevert();
        veMezo.safeTransferFrom(bob, address(vault), id);
    }

    function test_setDepositCap_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setDepositCap(1);
    }

    // ---- streaming ----

    function test_stream_paysOutLinearlyOverAWeek() public {
        _depositShard(alice, 100e18);
        _notify(700e18);
        assertEq(vault.claimable(alice), 0);

        skip(1 days);
        assertApproxEqAbs(vault.claimable(alice), 100e18, 1e6);

        skip(STREAM);
        assertApproxEqAbs(vault.claimable(alice), 700e18, 1e6);
    }

    function test_stream_buyingInAtPayoutEarnsNothingThatBlock() public {
        _depositShard(alice, 100e18);
        _notify(700e18);

        vm.prank(alice);
        vault.transfer(bob, 50e18);
        assertEq(vault.claimable(bob), 0);

        vm.prank(bob);
        assertEq(vault.claim(), 0);
    }

    function test_stream_lateDepositorOnlySharesWhatIsLeft() public {
        _depositShard(alice, 100e18);
        _notify(700e18);
        skip(6 days);
        _depositShard(bob, 100e18);
        skip(1 days);

        assertApproxEqAbs(vault.claimable(alice), 650e18, 1e6);
        assertApproxEqAbs(vault.claimable(bob), 50e18, 1e6);
    }

    function test_stream_newPayoutRollsTheRemainderForward() public {
        _depositShard(alice, 100e18);
        _notify(700e18);
        skip(1 days);
        _notify(700e18);
        skip(STREAM);
        assertApproxEqAbs(vault.claimable(alice), 1_400e18, 1e6);
    }

    function test_stream_dustCannotStretchThePayout() public {
        _depositShard(alice, 100e18);
        _notify(700e18);
        uint256 finish = vault.streamFinish(address(musd));

        skip(1 days);
        _notify(1);
        assertEq(vault.streamFinish(address(musd)), finish, "dust is queued, not started");
    }

    function test_stream_unclaimedIsHeldBackFromSync() public {
        _depositShard(alice, 100e18);
        _notify(700e18);
        skip(STREAM);
        vault.syncRewards();
        skip(STREAM);
        assertApproxEqAbs(vault.claimable(alice), 700e18, 1e6);
    }

    function test_claim_paysAcrossTheStream() public {
        _depositShard(alice, 100e18);
        _notify(700e18);
        skip(STREAM);
        vm.prank(alice);
        uint256 paid = vault.claim();
        assertApproxEqAbs(paid, 700e18, 1e6);
        assertEq(musd.balanceOf(alice), paid);
        assertEq(vault.rewardsClaimed(alice), paid);
        assertEq(vault.claimable(alice), 0);
    }

    function test_stream_withNoEligibleHoldersIsKeptForLater() public {
        _depositShard(alice, 100e18);
        _notify(700e18);
        uint256 shard = vault.shardIds()[0];
        vm.prank(alice);
        vault.redeem(shard);
        skip(STREAM);

        _depositShard(bob, 100e18);
        vault.syncRewards();
        skip(STREAM);
        assertApproxEqAbs(vault.claimable(bob) + vault.claimable(alice), 700e18, 1e6);
    }

    // ---- pool exclusion ----

    function test_excluded_accountEarnsNothingAndOthersGetItAll() public {
        address pool = makeAddr("pool");
        vm.prank(owner);
        vault.excludeFromRewards(pool);
        _depositShard(alice, 100e18);
        vm.prank(alice);
        vault.transfer(pool, 50e18);
        assertEq(vault.excludedSupply(), 50e18);

        _notify(700e18);
        skip(STREAM);

        assertEq(vault.claimable(pool), 0);
        assertApproxEqAbs(vault.claimable(alice), 700e18, 1e6);
    }

    function test_excluded_leavingThePoolEarnsAgain() public {
        address pool = makeAddr("pool");
        vm.prank(owner);
        vault.excludeFromRewards(pool);
        _depositShard(alice, 100e18);
        vm.prank(alice);
        vault.transfer(pool, 100e18);
        vm.prank(pool);
        vault.transfer(bob, 100e18);

        assertEq(vault.excludedSupply(), 0);
        _notify(700e18);
        skip(STREAM);
        assertApproxEqAbs(vault.claimable(bob), 700e18, 1e6);
    }

    function test_excludeFromRewards_revertsWithABalance() public {
        _depositShard(alice, 100e18);
        vm.prank(owner);
        vm.expectRevert(JanusRewards.HasBalance.selector);
        vault.excludeFromRewards(alice);
    }

    function test_excludeFromRewards_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.excludeFromRewards(bob);
    }

    // ---- bribes ----

    function _bribe(MockERC20 token, uint256 amount) internal {
        token.mint(address(voter), amount);
        voter.seedBribe(address(token), amount);
    }

    function _harvest(uint256 shard, address token) internal {
        address[] memory bribes = new address[](1);
        address[][] memory tokens = new address[][](1);
        tokens[0] = new address[](1);
        tokens[0][0] = token;
        vault.harvestBribes(bribes, tokens, shard);
    }

    function test_harvest_streamsMusdBribesToHolders() public {
        uint256 id = _depositShard(alice, 100e18);
        _bribe(musd, 70e18);
        _harvest(id, address(musd));
        skip(STREAM);
        assertApproxEqAbs(vault.claimable(alice), 70e18, 1e6);
    }

    function test_harvest_otherTokensStreamOnceRegistered() public {
        MockERC20 mezo = new MockERC20("Mezo", "MEZO");
        vm.prank(owner);
        vault.addRewardToken(address(mezo));

        uint256 id = _depositShard(alice, 100e18);
        _bribe(mezo, 70e18);
        _harvest(id, address(mezo));
        skip(STREAM);
        assertApproxEqAbs(vault.claimableToken(address(mezo), alice), 70e18, 1e6);

        vm.prank(alice);
        vault.claim();
        assertApproxEqAbs(mezo.balanceOf(alice), 70e18, 1e6);
    }

    function test_harvest_unregisteredTokenWaitsUntilAdded() public {
        MockERC20 mezo = new MockERC20("Mezo", "MEZO");
        uint256 id = _depositShard(alice, 100e18);
        _bribe(mezo, 70e18);
        _harvest(id, address(mezo));
        assertEq(mezo.balanceOf(address(vault)), 70e18);

        vm.prank(owner);
        vault.addRewardToken(address(mezo));
        vault.syncRewards();
        skip(STREAM);
        assertApproxEqAbs(vault.claimableToken(address(mezo), alice), 70e18, 1e6);
    }

    function test_harvest_revertsForAnUnknownShard() public {
        vm.expectRevert(abi.encodeWithSelector(JanusVault.UnknownShard.selector, 999));
        _harvest(999, address(musd));
    }

    function test_addRewardToken_isBounded() public {
        vm.startPrank(owner);
        for (uint256 i = 1; i < vault.MAX_REWARD_TOKENS(); i++) {
            vault.addRewardToken(address(new MockERC20("T", "T")));
        }
        address extra = address(new MockERC20("T", "T"));
        vm.expectRevert(JanusRewards.TooManyRewardTokens.selector);
        vault.addRewardToken(extra);
        vm.stopPrank();
    }

    function test_addRewardToken_rejectsDuplicates() public {
        vm.prank(owner);
        vm.expectRevert(JanusRewards.RewardTokenExists.selector);
        vault.addRewardToken(address(musd));
    }

    function testFuzz_rewards_neverExceedWhatWasNotified(uint96 amount, uint32 elapsed, uint96 moved) public {
        amount = uint96(bound(amount, 1e6, 1_000_000e18));
        moved = uint96(bound(moved, 0, 100e18));
        _depositShard(alice, 100e18);
        _depositShard(bob, 100e18);
        _notify(amount);
        skip(bound(elapsed, 0, STREAM));
        vm.prank(alice);
        vault.transfer(carol, moved);
        skip(STREAM);

        uint256 owed = vault.claimable(alice) + vault.claimable(bob) + vault.claimable(carol);
        assertLe(owed, amount);
        assertApproxEqAbs(owed, amount, 1e7);
    }
}
