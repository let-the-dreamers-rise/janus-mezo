// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IVotingEscrow} from "../../src/interfaces/IVotingEscrow.sol";

/// @notice Test double for Mezo's VotingEscrow, used for both veMEZO and veBTC.
/// @dev Reproduces what Janus relies on: the receiver hook on safe transfers, zero
///      voting power in the block of an ownership change, permanent locks, unvested
///      grants, the voter's voted flag and the booster's boost factor. Totals are set
///      by the test, which keeps boost arithmetic easy to reason about.
contract MockVotingEscrow {
    using SafeCast for uint256;
    using SafeCast for int256;

    error NotApprovedOrOwner();
    error NotOwner();
    error NotNormalNFT();
    error NotManagedOrNormalNFT();
    error PermanentLock();
    error LockExpired();
    error NoLockFound();
    error NotVoter();
    error NotBooster();
    error ERC721ReceiverRejectedTokens();
    error ERC721TransferToNonERC721ReceiverImplementer();

    uint256 public immutable maxLockTime;
    address public voter;
    address public booster;
    uint256 public tokenId;

    uint256 internal _totalVotingPower;
    uint256 internal _unboostedTotalVotingPower;

    mapping(uint256 => address) internal _owners;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;
    mapping(uint256 => IVotingEscrow.LockedBalance) internal _locked;
    mapping(uint256 => IVotingEscrow.EscrowType) public escrowType;
    mapping(uint256 => uint256) public vestingEnd;
    mapping(uint256 => bool) public voted;
    mapping(uint256 => uint256) public ownershipChange;

    constructor(uint256 maxLockTime_) {
        maxLockTime = maxLockTime_;
    }

    // ---- test setup ----

    function setVoter(address voter_) external {
        voter = voter_;
    }

    function setBooster(address booster_) external {
        booster = booster_;
    }

    function setTotals(uint256 total, uint256 unboostedTotal) external {
        _totalVotingPower = total;
        _unboostedTotalVotingPower = unboostedTotal;
    }

    function setEscrowType(uint256 id, IVotingEscrow.EscrowType kind) external {
        escrowType[id] = kind;
    }

    function setVestingEnd(uint256 id, uint256 end) external {
        vestingEnd[id] = end;
    }

    function mint(address to, uint256 amount, uint256 end, bool permanent)
        external
        returns (uint256 id)
    {
        id = ++tokenId;
        _owners[id] = to;
        balanceOf[to] += 1;
        _locked[id] = IVotingEscrow.LockedBalance({
            amount: amount.toInt256().toInt128(),
            end: permanent ? 0 : end,
            isPermanent: permanent,
            boost: 0
        });
    }

    function depositFor(uint256 id, uint256 value) external {
        _locked[id].amount += value.toInt256().toInt128();
    }

    // ---- ERC721 ----

    function ownerOf(uint256 id) external view returns (address) {
        return _owners[id];
    }

    function approve(address to, uint256 id) external {
        address owner = _owners[id];
        if (msg.sender != owner && !isApprovedForAll[owner][msg.sender]) {
            revert NotApprovedOrOwner();
        }
        getApproved[id] = to;
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
    }

    function isApprovedOrOwner(address spender, uint256 id) public view returns (bool) {
        address owner = _owners[id];
        return spender == owner || spender == getApproved[id] || isApprovedForAll[owner][spender];
    }

    function transferFrom(address from, address to, uint256 id) external {
        _transfer(from, to, id);
    }

    function safeTransferFrom(address from, address to, uint256 id) external {
        safeTransferFrom(from, to, id, "");
    }

    function safeTransferFrom(address from, address to, uint256 id, bytes memory data) public {
        _transfer(from, to, id);
        if (to.code.length == 0) return;
        try IERC721Receiver(to).onERC721Received(msg.sender, from, id, data) returns (
            bytes4 response
        ) {
            if (response != IERC721Receiver.onERC721Received.selector) {
                revert ERC721ReceiverRejectedTokens();
            }
        } catch (bytes memory reason) {
            if (reason.length == 0) revert ERC721TransferToNonERC721ReceiverImplementer();
            assembly {
                revert(add(32, reason), mload(reason))
            }
        }
    }

    function _transfer(address from, address to, uint256 id) internal {
        if (escrowType[id] == IVotingEscrow.EscrowType.LOCKED) revert NotManagedOrNormalNFT();
        if (!isApprovedOrOwner(msg.sender, id)) revert NotApprovedOrOwner();
        if (_owners[id] != from) revert NotOwner();
        delete getApproved[id];
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        _owners[id] = to;
        ownershipChange[id] = block.number;
    }

    // ---- locks ----

    function locked(uint256 id) external view returns (IVotingEscrow.LockedBalance memory) {
        return _locked[id];
    }

    function lockPermanent(uint256 id) external {
        if (!isApprovedOrOwner(msg.sender, id)) revert NotApprovedOrOwner();
        if (escrowType[id] != IVotingEscrow.EscrowType.NORMAL) revert NotNormalNFT();
        IVotingEscrow.LockedBalance memory lock = _locked[id];
        if (lock.isPermanent) revert PermanentLock();
        if (lock.end <= block.timestamp) revert LockExpired();
        if (lock.amount <= 0) revert NoLockFound();
        _locked[id].end = 0;
        _locked[id].isPermanent = true;
    }

    function deactivated(uint256) external pure returns (bool) {
        return false;
    }

    // ---- voting power ----

    function votingPowerOfNFT(uint256 id) public view returns (uint256) {
        uint256 base = unboostedVotingPowerOfNFT(id);
        uint256 boost = _locked[id].boost;
        return boost == 0 ? base : (base * boost) / 1e18;
    }

    function unboostedVotingPowerOfNFT(uint256 id) public view returns (uint256) {
        if (ownershipChange[id] == block.number) return 0;
        IVotingEscrow.LockedBalance memory lock = _locked[id];
        if (lock.amount <= 0) return 0;
        uint256 amount = uint256(int256(lock.amount));
        if (lock.isPermanent) return amount;
        if (lock.end <= block.timestamp) return 0;
        return (amount * (lock.end - block.timestamp)) / maxLockTime;
    }

    function totalVotingPower() external view returns (uint256) {
        return _totalVotingPower;
    }

    function unboostedTotalVotingPower() external view returns (uint256) {
        return _unboostedTotalVotingPower;
    }

    // ---- voter and booster hooks ----

    function voting(uint256 id, bool voted_) external {
        if (msg.sender != voter) revert NotVoter();
        voted[id] = voted_;
    }

    function updateBoost(uint256 id, uint256 boost) external {
        if (msg.sender != booster) revert NotBooster();
        _locked[id].boost = boost;
    }
}
