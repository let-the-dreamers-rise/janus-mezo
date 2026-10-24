import { parseAbi } from "viem";

export const boostVoterAbi = parseAbi([
  "function ve() view returns (address)",
  "function boostableVe() view returns (address)",
  "function factoryRegistry() view returns (address)",
  "function governor() view returns (address)",
  "function length() view returns (uint256)",
  "function gauges(uint256) view returns (address)",
  "function maxVotingNum() view returns (uint256)",
  "function totalWeight() view returns (uint256)",
  "function weights(address gauge) view returns (uint256)",
  "function votes(uint256 tokenId, address gauge) view returns (uint256)",
  "function usedWeights(uint256 tokenId) view returns (uint256)",
  "function lastVoted(uint256 tokenId) view returns (uint256)",
  "function isAlive(address gauge) view returns (bool)",
  "function isGauge(address gauge) view returns (bool)",
  "function boostableTokenIdToGauge(uint256 tokenId) view returns (address)",
  "function getBoost(uint256 boostableTokenId) view returns (uint256)",
  "function epochStart(uint256 ts) pure returns (uint256)",
  "function epochNext(uint256 ts) pure returns (uint256)",
  "function epochVoteStart(uint256 ts) pure returns (uint256)",
  "function epochVoteEnd(uint256 ts) pure returns (uint256)",
  "function vote(uint256 tokenId, address[] gauges, uint256[] weights)",
  "function reset(uint256 tokenId)",
  "function poke(uint256 tokenId)",
  "function pokeBoost(uint256 boostableTokenId)",
  "function pokeBoosts(uint256[] boostableTokenIds)",
  "function createBoostGauge(address gaugeFactory, uint256 boostableTokenId, address[] tokens, uint256[] amounts) returns (address)",
  "event Voted(address indexed voter, address indexed gauge, uint256 indexed tokenId, uint256 weight, uint256 totalWeight, uint256 timestamp)",
  "event BoostPoked(uint256 indexed boostableTokenId, uint256 boost)",
  "event BoostGaugeCreated(uint256 indexed boostableTokenId, address indexed gauge)",
  "event GaugeCreated(address indexed gauge, address indexed bribeVotingReward, address indexed creator)",
]);

export const gaugeAbi = parseAbi([
  "function factory() view returns (address)",
  "function voter() view returns (address)",
  "function boostableTokenId() view returns (uint256)",
  "function beneficiary() view returns (address)",
]);

export const votingEscrowAbi = parseAbi([
  "struct LockedBalance { int128 amount; uint256 end; bool isPermanent; uint256 boost; }",
  "function token() view returns (address)",
  "function team() view returns (address)",
  "function voter() view returns (address)",
  "function booster() view returns (address)",
  "function isSecondaryVoter(address) view returns (bool)",
  "function tokenId() view returns (uint256)",
  "function supply() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerToNFTokenIdList(address owner, uint256 index) view returns (uint256)",
  "function locked(uint256 tokenId) view returns (LockedBalance)",
  "function escrowType(uint256 tokenId) view returns (uint8)",
  "function voted(uint256 tokenId) view returns (bool)",
  "function delegates(uint256 delegator) view returns (uint256)",
  "function vestingEnd(uint256 tokenId) view returns (uint256)",
  "function votingPowerOfNFT(uint256 tokenId) view returns (uint256)",
  "function unboostedVotingPowerOfNFT(uint256 tokenId) view returns (uint256)",
  "function totalVotingPower() view returns (uint256)",
  "function unboostedTotalVotingPower() view returns (uint256)",
  "function isApprovedOrOwner(address spender, uint256 tokenId) view returns (bool)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function approve(address to, uint256 tokenId)",
  "function setApprovalForAll(address operator, bool approved)",
  "function createLock(uint256 value, uint256 lockDuration) returns (uint256)",
  "function createLockFor(uint256 value, uint256 lockDuration, address to) returns (uint256)",
  "function lockPermanent(uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

export const factoryRegistryAbi = parseAbi([
  "function gaugeFactories() view returns (address[])",
  "function isGaugeFactoryApproved(address) view returns (bool)",
  "function gaugeFactoryToVotingRewardsFactory(address) view returns (address)",
  "function owner() view returns (address)",
]);

export const erc20Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

export const dexRouterAbi = parseAbi([
  "struct Route { address from; address to; bool stable; address factory; }",
  "function getAmountsOut(uint256 amountIn, Route[] routes) view returns (uint256[] amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, Route[] routes, address to, uint256 deadline) returns (uint256[] amounts)",
]);
