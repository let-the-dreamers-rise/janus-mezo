// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IVotingEscrow} from "../interfaces/IVotingEscrow.sol";
import {IBoostVoter} from "../interfaces/IBoostVoter.sol";
import {BoostMath} from "../libraries/BoostMath.sol";

/// @title BoostOrders
/// @notice Standing buy orders for veMEZO boost votes. A veBTC holder escrows MUSD, names
///         a price per vote and a target boost, and the order is considered every round
///         until it is cancelled or its escrow runs out.
/// @dev Prices are MUSD wei per 1e18 votes (one veMEZO of voting power) per round.
abstract contract BoostOrders is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    struct Order {
        address owner;
        uint256 tokenId;
        uint256 pricePerVote;
        uint256 targetBoost;
        uint256 escrow;
    }

    /// @notice Cap on live orders. It keeps settle and finalize, which walk every order,
    ///         well inside Mezo's 10M block gas limit.
    uint256 public constant MAX_ACTIVE_ORDERS = 32;
    uint256 public constant MAX_PRICE_PER_VOTE = 1e30;
    uint256 internal constant VOTE_UNIT = 1e18;

    IVotingEscrow public immutable veBtc;
    IBoostVoter public immutable boostVoter;
    IERC20 public immutable musd;

    uint256 public minPricePerVote;
    uint256 public nextOrderId = 1;

    mapping(uint256 orderId => Order) internal _orders;
    mapping(uint256 tokenId => uint256 orderId) public orderOfToken;
    EnumerableSet.UintSet internal _activeOrders;

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed owner,
        uint256 indexed tokenId,
        uint256 pricePerVote,
        uint256 targetBoost,
        uint256 escrow
    );
    event OrderUpdated(uint256 indexed orderId, uint256 pricePerVote, uint256 targetBoost);
    event OrderToppedUp(uint256 indexed orderId, uint256 amount, uint256 escrow);
    event OrderClosed(uint256 indexed orderId, uint256 refund, bool pruned);
    event MinPricePerVoteSet(uint256 minPricePerVote);

    error ZeroAddress();
    error ZeroAmount();
    error NotTokenOwner(uint256 tokenId);
    error OrderExists(uint256 tokenId, uint256 orderId);
    error NoBoostGauge(uint256 tokenId);
    error InvalidPrice(uint256 pricePerVote);
    error InvalidTarget(uint256 targetBoost);
    error TooManyOrders();
    error UnknownOrder(uint256 orderId);
    error NotOrderOwner(uint256 orderId);
    error OrderLocked(uint256 orderId);
    error NotPrunable(uint256 orderId);

    constructor(
        IVotingEscrow veBtc_,
        IBoostVoter boostVoter_,
        IERC20 musd_,
        address owner_,
        uint256 minPricePerVote_
    ) Ownable(owner_) {
        if (
            address(veBtc_) == address(0) || address(boostVoter_) == address(0)
                || address(musd_) == address(0)
        ) revert ZeroAddress();
        if (minPricePerVote_ > MAX_PRICE_PER_VOTE) revert InvalidPrice(minPricePerVote_);
        veBtc = veBtc_;
        boostVoter = boostVoter_;
        musd = musd_;
        minPricePerVote = minPricePerVote_;
    }

    /// @notice Escrows MUSD and opens a standing order to boost `tokenId`, a veBTC NFT
    ///         owned by the caller that already has a BoostVoter gauge.
    function placeOrder(uint256 tokenId, uint256 pricePerVote, uint256 targetBoost, uint256 escrow)
        external
        nonReentrant
        returns (uint256 orderId)
    {
        if (veBtc.ownerOf(tokenId) != msg.sender) revert NotTokenOwner(tokenId);
        uint256 existing = orderOfToken[tokenId];
        if (existing != 0) revert OrderExists(tokenId, existing);
        if (boostVoter.boostableTokenIdToGauge(tokenId) == address(0)) {
            revert NoBoostGauge(tokenId);
        }
        _checkTerms(pricePerVote, targetBoost);
        if (escrow == 0) revert ZeroAmount();
        if (_activeOrders.length() >= MAX_ACTIVE_ORDERS) revert TooManyOrders();

        orderId = nextOrderId++;
        _orders[orderId] = Order({
            owner: msg.sender,
            tokenId: tokenId,
            pricePerVote: pricePerVote,
            targetBoost: targetBoost,
            escrow: escrow
        });
        orderOfToken[tokenId] = orderId;
        _activeOrders.add(orderId);

        musd.safeTransferFrom(msg.sender, address(this), escrow);
        emit OrderPlaced(orderId, msg.sender, tokenId, pricePerVote, targetBoost, escrow);
    }

    /// @notice Changes price and target. A round that is already settled keeps the old terms.
    function updateOrder(uint256 orderId, uint256 pricePerVote, uint256 targetBoost) external {
        Order storage order = _ownedOrder(orderId);
        _checkTerms(pricePerVote, targetBoost);
        order.pricePerVote = pricePerVote;
        order.targetBoost = targetBoost;
        emit OrderUpdated(orderId, pricePerVote, targetBoost);
    }

    function topUp(uint256 orderId, uint256 amount) external nonReentrant {
        Order storage order = _ownedOrder(orderId);
        if (amount == 0) revert ZeroAmount();
        order.escrow += amount;
        musd.safeTransferFrom(msg.sender, address(this), amount);
        emit OrderToppedUp(orderId, amount, order.escrow);
    }

    /// @notice Closes the caller's order and refunds the remaining escrow.
    function cancelOrder(uint256 orderId) external nonReentrant {
        _ownedOrder(orderId);
        _closeOrder(orderId, false);
    }

    /// @notice Closes an order that can no longer be filled and refunds its owner.
    ///         Anyone may call it, which keeps the order book free of dead weight.
    function pruneOrder(uint256 orderId) external nonReentrant {
        if (!_activeOrders.contains(orderId)) revert UnknownOrder(orderId);
        if (!_isPrunable(_orders[orderId])) revert NotPrunable(orderId);
        _closeOrder(orderId, true);
    }

    function setMinPricePerVote(uint256 price) external onlyOwner {
        if (price > MAX_PRICE_PER_VOTE) revert InvalidPrice(price);
        minPricePerVote = price;
        emit MinPricePerVoteSet(price);
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return _orders[orderId];
    }

    function activeOrderIds() external view returns (uint256[] memory) {
        return _activeOrders.values();
    }

    function activeOrderCount() external view returns (uint256) {
        return _activeOrders.length();
    }

    function isActiveOrder(uint256 orderId) external view returns (bool) {
        return _activeOrders.contains(orderId);
    }

    /// @dev True while a settled round may still charge this order.
    function _isLocked(uint256 orderId) internal view virtual returns (bool);

    function _closeOrder(uint256 orderId, bool pruned) internal {
        if (_isLocked(orderId)) revert OrderLocked(orderId);
        Order memory order = _orders[orderId];
        _activeOrders.remove(orderId);
        delete orderOfToken[order.tokenId];
        delete _orders[orderId];
        if (order.escrow > 0) musd.safeTransfer(order.owner, order.escrow);
        emit OrderClosed(orderId, order.escrow, pruned);
    }

    function _ownedOrder(uint256 orderId) internal view returns (Order storage order) {
        if (!_activeOrders.contains(orderId)) revert UnknownOrder(orderId);
        order = _orders[orderId];
        if (order.owner != msg.sender) revert NotOrderOwner(orderId);
    }

    function _isPrunable(Order memory order) internal view returns (bool) {
        if (veBtc.ownerOf(order.tokenId) != order.owner) return true;
        address gauge = boostVoter.boostableTokenIdToGauge(order.tokenId);
        if (gauge == address(0) || !boostVoter.isAlive(gauge)) return true;
        return order.escrow < order.pricePerVote;
    }

    function _checkTerms(uint256 pricePerVote, uint256 targetBoost) internal view {
        if (
            pricePerVote == 0 || pricePerVote < minPricePerVote
                || pricePerVote > MAX_PRICE_PER_VOTE
        ) revert InvalidPrice(pricePerVote);
        if (targetBoost <= BoostMath.BASE_BOOST || targetBoost > BoostMath.MAX_BOOST) {
            revert InvalidTarget(targetBoost);
        }
    }
}
