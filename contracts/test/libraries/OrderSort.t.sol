// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OrderSort} from "../../src/libraries/OrderSort.sol";

contract OrderSortTest is Test {
    function _bid(uint256 id, uint256 price) internal pure returns (OrderSort.Bid memory) {
        return OrderSort.Bid({orderId: id, price: price});
    }

    function test_sorted_highestPriceFirstThenOldest() public pure {
        OrderSort.Bid[] memory bids = new OrderSort.Bid[](4);
        bids[0] = _bid(1, 10);
        bids[1] = _bid(3, 30);
        bids[2] = _bid(2, 30);
        bids[3] = _bid(4, 20);

        OrderSort.Bid[] memory out = OrderSort.sorted(bids);

        assertEq(out[0].orderId, 2);
        assertEq(out[1].orderId, 3);
        assertEq(out[2].orderId, 4);
        assertEq(out[3].orderId, 1);
        // The input keeps its original order.
        assertEq(bids[0].orderId, 1);
        assertEq(bids[1].orderId, 3);
    }

    function test_sorted_handlesEmpty() public pure {
        assertEq(OrderSort.sorted(new OrderSort.Bid[](0)).length, 0);
    }

    function testFuzz_sorted_isOrderedPermutation(uint256 seed) public pure {
        uint256 n = 1 + (seed % 20);
        OrderSort.Bid[] memory bids = new OrderSort.Bid[](n);
        uint256 idSum;
        uint256 idSquares;
        for (uint256 i = 0; i < n; i++) {
            bids[i] = _bid(i + 1, uint256(keccak256(abi.encode(seed, i))) % 5);
            idSum += i + 1;
            idSquares += (i + 1) * (i + 1);
        }

        OrderSort.Bid[] memory out = OrderSort.sorted(bids);

        uint256 outSum = out[0].orderId;
        uint256 outSquares = out[0].orderId * out[0].orderId;
        for (uint256 i = 1; i < n; i++) {
            OrderSort.Bid memory prev = out[i - 1];
            OrderSort.Bid memory cur = out[i];
            assertTrue(prev.price > cur.price || (prev.price == cur.price && prev.orderId < cur.orderId));
            outSum += cur.orderId;
            outSquares += cur.orderId * cur.orderId;
        }
        assertEq(outSum, idSum);
        assertEq(outSquares, idSquares);
    }
}
