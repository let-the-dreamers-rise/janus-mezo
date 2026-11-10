// Read-only audit of Janus on matsnet and of Mezo's mainnet addresses. Sends no transactions.
// Usage (from keeper/): npx tsx scripts/wave2-audit.ts
import { createPublicClient, http, parseAbi, formatUnits, type Address } from "viem";

const test = createPublicClient({ transport: http("https://rpc.test.mezo.org") });
const main = createPublicClient({ transport: http("https://rpc-http.mezo.boar.network") });
const MARKET: Address = "0x9098b6f514f322A6f57501cdd92e7aBf79E41870";
const VAULT: Address = "0xDC1db035D17356Fc4aADd9cdB80F264512DA2879";
const MAIN_VOTER: Address = "0x2Ba614a598Cffa5a19d683cDCA97bac3a49313d1";
const DEPLOY_VEBTC: Address = "0x7D807e9CE1ef73048FEe9A4214e75e894ea25914";

const voterAbi = parseAbi(["function ve() view returns (address)", "function boostableVe() view returns (address)", "function maxVotingNum() view returns (uint256)"]);
const marketAbi = parseAbi([
  "function roundId() view returns (uint256)",
  "function fallbackGauge() view returns (address)",
  "function activeOrderIds() view returns (uint256[])",
]);
const vaultAbi = parseAbi(["function shardIds() view returns (uint256[])", "function totalSupply() view returns (uint256)"]);

const safe = async <T>(label: string, f: () => Promise<T>) => {
  try {
    console.log(label, await f());
  } catch (e) {
    console.log(label, "ERR", (e as Error).message.split("\n")[0]);
  }
};

await safe("mainnet chainId", () => main.getChainId());
await safe("mainnet voter.ve", () => main.readContract({ address: MAIN_VOTER, abi: voterAbi, functionName: "ve" }));
await safe("mainnet voter.boostableVe", () => main.readContract({ address: MAIN_VOTER, abi: voterAbi, functionName: "boostableVe" }));
await safe("Deploy.s.sol veBTC code size", async () => ((await main.getCode({ address: DEPLOY_VEBTC })) ?? "0x").length);
await safe("matsnet roundId", () => test.readContract({ address: MARKET, abi: marketAbi, functionName: "roundId" }));
await safe("matsnet shards", () => test.readContract({ address: VAULT, abi: vaultAbi, functionName: "shardIds" }));
await safe("jMEZO supply", async () => formatUnits(await test.readContract({ address: VAULT, abi: vaultAbi, functionName: "totalSupply" }), 18));
const orderAbi = parseAbi([
  "struct Order { address owner; uint256 tokenId; uint256 pricePerVote; uint256 targetBoost; uint256 escrow; }",
  "function getOrder(uint256) view returns (Order)",
]);
const ids = await test.readContract({ address: MARKET, abi: marketAbi, functionName: "activeOrderIds" });
for (const id of ids) {
  await safe(`order ${id}`, async () => {
    const o = await test.readContract({ address: MARKET, abi: orderAbi, functionName: "getOrder", args: [id] });
    return `${o.owner} veBTC #${o.tokenId} ${formatUnits(o.pricePerVote, 18)} MUSD/vote target ${formatUnits(o.targetBoost, 18)} escrow ${formatUnits(o.escrow, 18)}`;
  });
}
const fillAbi = parseAbi([
  "function fills(uint256,uint256) view returns (address gauge, uint96 votes, uint128 pricePerVote, uint128 charged)",
  "function roundOrders(uint256) view returns (uint256[])",
]);
const boostAbi = parseAbi(["function getBoost(uint256) view returns (uint256)"]);
const VOTER: Address = "0x21d7bDF5a5929AD179F8cA0c9014A0B62ae6Bfd1";
for (const round of [1n, 2n]) {
  const orders = await test.readContract({ address: MARKET, abi: fillAbi, functionName: "roundOrders", args: [round] });
  for (const o of orders) {
    await safe(`round ${round} order ${o}`, async () => {
      const [, votes, price, charged] = await test.readContract({ address: MARKET, abi: fillAbi, functionName: "fills", args: [round, o] });
      const order = await test.readContract({ address: MARKET, abi: orderAbi, functionName: "getOrder", args: [o] });
      const boost = await test.readContract({ address: VOTER, abi: boostAbi, functionName: "getBoost", args: [order.tokenId] });
      return `votes ${formatUnits(votes, 18)} price ${formatUnits(price, 18)} charged ${formatUnits(charged, 18)} veBTC #${order.tokenId} owner ${order.owner.slice(0, 8)} boost ${formatUnits(boost, 18)}`;
    });
  }
}
await safe("block time", async () => new Date(Number((await test.getBlock()).timestamp) * 1000).toISOString());
