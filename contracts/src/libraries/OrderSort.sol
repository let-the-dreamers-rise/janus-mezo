// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OrderSort
/// @notice Deterministic priority for boost bids: highest price first and, among equal
///         prices, the older order (lower id) first. Keepers have no say in the order.
library OrderSort {
    struct Bid {
        uint256 orderId;
        uint256 price;
    }

    /// @notice Returns a sorted copy of `bids`; the input array is left untouched.
    /// @dev Insertion sort into a fresh array. The market caps active orders, so n stays small.
    function sorted(Bid[] memory bids) internal pure returns (Bid[] memory out) {
        out = new Bid[](bids.length);
        for (uint256 i = 0; i < bids.length; i++) {
            Bid memory key = bids[i];
            uint256 j = i;
            while (j > 0 && _outranks(key, out[j - 1])) {
                out[j] = out[j - 1];
                j--;
            }
            out[j] = key;
        }
    }

    function _outranks(Bid memory a, Bid memory b) private pure returns (bool) {
        return a.price > b.price || (a.price == b.price && a.orderId < b.orderId);
    }
}
