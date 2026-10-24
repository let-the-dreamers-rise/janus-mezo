// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BoostOrders} from "../src/market/BoostOrders.sol";
import {JanusFixture} from "./utils/JanusFixture.sol";

contract BoostOrdersTest is JanusFixture {
    uint256 internal bobNft;
    address internal bobGauge;

    function setUp() public override {
        super.setUp();
        (bobNft, bobGauge) = _boostable(bob, 1e18);
    }

    function _expectPlaceRevert(address who, uint256 tokenId, uint256 price, uint256 target, uint256 escrow, bytes memory err)
        internal
    {
        musd.mint(who, escrow);
        vm.startPrank(who);
        musd.approve(address(market), escrow);
        vm.expectRevert(err);
        market.placeOrder(tokenId, price, target, escrow);
        vm.stopPrank();
    }

    // ---- placing ----

    function test_placeOrder_escrowsMusdAndIndexesTheOrder() public {
        uint256 orderId = _placeOrder(bob, bobNft, 2e15, 5e18, 50e18);

        BoostOrders.Order memory order = market.getOrder(orderId);
        assertEq(order.owner, bob);
        assertEq(order.tokenId, bobNft);
        assertEq(order.pricePerVote, 2e15);
        assertEq(order.targetBoost, 5e18);
        assertEq(order.escrow, 50e18);
        assertEq(market.orderOfToken(bobNft), orderId);
        assertEq(musd.balanceOf(address(market)), 50e18);
        assertEq(market.activeOrderCount(), 1);
        assertEq(market.activeOrderIds()[0], orderId);
        assertTrue(market.isActiveOrder(orderId));
    }

    function test_placeOrder_requiresTheNftOwner() public {
        _expectPlaceRevert(
            carol, bobNft, 2e15, 5e18, 10e18, abi.encodeWithSelector(BoostOrders.NotTokenOwner.selector, bobNft)
        );
    }

    function test_placeOrder_requiresABoostGauge() public {
        uint256 bare = veBtc.mint(bob, 1e18, 0, true);
        _expectPlaceRevert(bob, bare, 2e15, 5e18, 10e18, abi.encodeWithSelector(BoostOrders.NoBoostGauge.selector, bare));
    }

    function test_placeOrder_onePerNft() public {
        uint256 first = _placeOrder(bob, bobNft, 2e15, 5e18, 10e18);
        _expectPlaceRevert(
            bob, bobNft, 2e15, 5e18, 10e18, abi.encodeWithSelector(BoostOrders.OrderExists.selector, bobNft, first)
        );
    }

    function test_placeOrder_validatesPrice() public {
        _expectPlaceRevert(
            bob, bobNft, MIN_PRICE - 1, 5e18, 10e18, abi.encodeWithSelector(BoostOrders.InvalidPrice.selector, MIN_PRICE - 1)
        );
        _expectPlaceRevert(
            bob, bobNft, 1e30 + 1, 5e18, 10e18, abi.encodeWithSelector(BoostOrders.InvalidPrice.selector, 1e30 + 1)
        );
    }

    function test_placeOrder_validatesTarget() public {
        _expectPlaceRevert(bob, bobNft, 2e15, 1e18, 10e18, abi.encodeWithSelector(BoostOrders.InvalidTarget.selector, 1e18));
        _expectPlaceRevert(
            bob, bobNft, 2e15, 5e18 + 1, 10e18, abi.encodeWithSelector(BoostOrders.InvalidTarget.selector, 5e18 + 1)
        );
    }

    function test_placeOrder_requiresEscrow() public {
        _expectPlaceRevert(bob, bobNft, 2e15, 5e18, 0, abi.encodeWithSelector(BoostOrders.ZeroAmount.selector));
    }

    function test_placeOrder_capsActiveOrders() public {
        uint256 cap = market.MAX_ACTIVE_ORDERS();
        for (uint256 i = 0; i < cap; i++) {
            (uint256 nft,) = _boostable(carol, 1e18);
            _placeOrder(carol, nft, 2e15, 5e18, 1e18);
        }
        (uint256 extra,) = _boostable(carol, 1e18);
        _expectPlaceRevert(carol, extra, 2e15, 5e18, 1e18, abi.encodeWithSelector(BoostOrders.TooManyOrders.selector));
    }

    // ---- managing ----

    function test_updateOrder_changesTerms() public {
        uint256 orderId = _placeOrder(bob, bobNft, 2e15, 5e18, 10e18);
        vm.prank(bob);
        market.updateOrder(orderId, 3e15, 4e18);
        BoostOrders.Order memory order = market.getOrder(orderId);
        assertEq(order.pricePerVote, 3e15);
        assertEq(order.targetBoost, 4e18);
    }

    function test_updateOrder_onlyItsOwner() public {
        uint256 orderId = _placeOrder(bob, bobNft, 2e15, 5e18, 10e18);
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(BoostOrders.NotOrderOwner.selector, orderId));
        market.updateOrder(orderId, 3e15, 4e18);
    }

    function test_topUp_addsEscrow() public {
        uint256 orderId = _placeOrder(bob, bobNft, 2e15, 5e18, 10e18);
        musd.mint(bob, 5e18);
        vm.startPrank(bob);
        musd.approve(address(market), 5e18);
        market.topUp(orderId, 5e18);
        vm.expectRevert(BoostOrders.ZeroAmount.selector);
        market.topUp(orderId, 0);
        vm.stopPrank();
        assertEq(market.getOrder(orderId).escrow, 15e18);
    }

    function test_cancelOrder_refundsAndFreesTheNft() public {
        uint256 orderId = _placeOrder(bob, bobNft, 2e15, 5e18, 10e18);
        vm.prank(bob);
        market.cancelOrder(orderId);

        assertEq(musd.balanceOf(bob), 10e18);
        assertEq(market.orderOfToken(bobNft), 0);
        assertFalse(market.isActiveOrder(orderId));
        assertEq(market.activeOrderCount(), 0);
        _placeOrder(bob, bobNft, 2e15, 5e18, 10e18);
    }

    function test_cancelOrder_rejectsUnknownOrder() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(BoostOrders.UnknownOrder.selector, 99));
        market.cancelOrder(99);
    }

    // ---- pruning ----

    function test_pruneOrder_whenTheNftChangedHands() public {
        uint256 orderId = _placeOrder(bob, bobNft, 2e15, 5e18, 10e18);
        vm.prank(bob);
        veBtc.transferFrom(bob, carol, bobNft);
        vm.prank(keeper);
        market.pruneOrder(orderId);
        assertEq(musd.balanceOf(bob), 10e18);
        assertFalse(market.isActiveOrder(orderId));
    }

    function test_pruneOrder_whenTheGaugeWasKilled() public {
        uint256 orderId = _placeOrder(bob, bobNft, 2e15, 5e18, 10e18);
        voter.killGauge(bobGauge);
        vm.prank(keeper);
        market.pruneOrder(orderId);
        assertEq(musd.balanceOf(bob), 10e18);
    }

    function test_pruneOrder_whenEscrowCannotBuyOneVote() public {
        uint256 orderId = _placeOrder(bob, bobNft, 2e15, 5e18, 1e15);
        vm.prank(keeper);
        market.pruneOrder(orderId);
        assertEq(musd.balanceOf(bob), 1e15);
    }

    function test_pruneOrder_refusesHealthyOrders() public {
        uint256 orderId = _placeOrder(bob, bobNft, 2e15, 5e18, 10e18);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(BoostOrders.NotPrunable.selector, orderId));
        market.pruneOrder(orderId);
    }

    function test_pruneOrder_rejectsUnknownOrder() public {
        vm.expectRevert(abi.encodeWithSelector(BoostOrders.UnknownOrder.selector, 5));
        market.pruneOrder(5);
    }

    // ---- admin ----

    function test_setMinPricePerVote_onlyOwnerAndBounded() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        market.setMinPricePerVote(1);

        vm.startPrank(owner);
        market.setMinPricePerVote(5e15);
        assertEq(market.minPricePerVote(), 5e15);
        vm.expectRevert(abi.encodeWithSelector(BoostOrders.InvalidPrice.selector, 1e30 + 1));
        market.setMinPricePerVote(1e30 + 1);
        vm.stopPrank();
    }
}
