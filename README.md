# Janus

The boost market for Mezo. veBTC holders bid MUSD for the veMEZO votes that lift their Mezo Earn
boost up to 5x. veMEZO holders pool their locks in one vault and earn 90% of every payment.

- **Live app:** https://janus-mezo.vercel.app
- **Seeded demo account, read-only, no wallet needed:**
  https://janus-mezo.vercel.app/boost/?as=0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C
- **Network:** Mezo testnet (matsnet, chain id 31611)
- Built for the Mezo Buildathon on AKINDO.

## The problem

A veBTC lock earns more MEZO when veMEZO votes point at its boost gauge, up to 5x. Getting those
votes is manual today: post bribes, ask voters, poke the boost after every change, and repeat every
weekly epoch. Small veBTC holders rarely reach 5x, and veMEZO holders chase small bribes by hand.

Vote power is the scarce input, and it is cheap. On 2026-10-24, mainnet veMEZO held about 280.7M
MEZO of locks (about $0.85M at the day's price) against about 912.6 BTC locked in veBTC. Roughly
$1 of veMEZO decided the boost on $75 of locked BTC.

## What Janus does

Janus turns that matching into a market priced in MUSD, with one face for each side.

| | veBTC holders (bronze face) | veMEZO holders (patina face) |
|---|---|---|
| Act | Bid MUSD per 1,000 votes and pick a target boost up to 5x | Deposit a veMEZO NFT and receive jMEZO 1:1 |
| Money | Pay only for votes delivered to your gauge. Unspent escrow stays yours | Earn 90% of every payment, claimable in MUSD at any time |
| Exit | Cancel between rounds and the remaining escrow comes back | Burn jMEZO equal to a shard's amount to take that veMEZO NFT back |

## How a round works

Every step is a permissionless call. The Janus keeper runs them inside Mezo's vote window, and
anyone can run them from the Market page.

| Step | Call | What happens |
|---|---|---|
| 1. Bid | `placeOrder` | A veBTC holder escrows MUSD with a price per 1,000 votes and a target boost |
| 2. Snapshot | `startRound` | The round takes every vault shard that has not voted this epoch |
| 3. Reset | `resetShards` | Old votes are cleared, so nobody keeps boost they stopped paying for |
| 4. Settle | `settle` | Each bid is priced with BoostVoter's own formula, and the highest bids fill first |
| 5. Vote | `castVotes` | Each shard votes its slice. Unsold power goes to the house gauge, never to a buyer for free |
| 6. Charge and pay | `finalize` | Buyers pay for delivered votes only: 90% to jMEZO holders, 10% to the treasury |
| 7. Apply boost | `BoostVoter.pokeBoost` | Writes each buyer's new boost into Mezo Earn |

## Try it

**Fastest: no wallet, no faucet.** Open `/start/` and press **Use a demo wallet**. The app makes a
throwaway testnet key in this browser and connects it. **Get a starter kit** then sends it gas,
5 MUSD and a fresh 100-sat veBTC lock (plus a 5 MEZO veMEZO lock while the kit wallet has MEZO), in
about 10 seconds. The checklist on `/start/` walks through gauge, bid, deposit, round, boost and
claim, and Market's **Run the whole round** runs every due step in order. The demo key only signs
transactions; **Forget** in the wallet menu deletes it. Kits are rate limited per IP and per address.

**Read-only.** Open the read-only link above.

1. Boost shows the demo account's three veBTC NFTs: the house gauge that collects unsold votes, and
   two NFTs with standing bids. The calculator prices boost for any lock size against live totals.
2. Market shows round 1, which ran on matsnet on 2026-10-24: 100 votes sold to two bids for
   4.05 MUSD. veBTC #1714 reached 5x, #1715 reached 2.82x, and jMEZO holders received 3.64 MUSD.
   The order book projects the next round.
3. Earn (`/earn/?as=...`) shows the vault's three veMEZO shards and the MUSD they earned.

**With a wallet** on Mezo testnet: an EVM wallet such as MetaMask or Rabby, or a Bitcoin wallet
(Unisat, OKX, Xverse) through Mezo Passport. Testnet BTC comes from https://faucet.test.mezo.org.

1. Boost: for a veBTC NFT you hold, create its boost gauge, approve MUSD and place a bid. The form
   shows the votes you need, the cost per round and where your bid would fill.
2. Earn: deposit a veMEZO NFT of at least 1 MEZO. Depositing makes the lock permanent.
3. Market: run any step that is due. The contract checks every rule, so a step that is not due
   fails in simulation before you sign.

Every shard in the vault has voted in the current epoch, so the next round starts when voting
opens for the next epoch (2026-10-29 01:00 UTC), or sooner if someone deposits a new veMEZO NFT.

## Deployment (matsnet)

| Contract | Address |
|---|---|
| JanusVault (jMEZO) | [`0xDC1db035D17356Fc4aADd9cdB80F264512DA2879`](https://explorer.test.mezo.org/address/0xDC1db035D17356Fc4aADd9cdB80F264512DA2879) |
| BoostMarket | [`0x9098b6f514f322A6f57501cdd92e7aBf79E41870`](https://explorer.test.mezo.org/address/0x9098b6f514f322A6f57501cdd92e7aBf79E41870) |
| Mezo BoostVoter | [`0x21d7bDF5a5929AD179F8cA0c9014A0B62ae6Bfd1`](https://explorer.test.mezo.org/address/0x21d7bDF5a5929AD179F8cA0c9014A0B62ae6Bfd1) |
| Mezo veMEZO | [`0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b`](https://explorer.test.mezo.org/address/0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b) |
| Mezo veBTC | [`0x38E35d92E6Bfc6787272A62345856B13eA12130a`](https://explorer.test.mezo.org/address/0x38E35d92E6Bfc6787272A62345856B13eA12130a) |
| MUSD | [`0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`](https://explorer.test.mezo.org/address/0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503) |

Deployed at block 16,345,522. Owner and treasury: `0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C`.
The seeded state is recorded in [`contracts/deployments/31611.seed.json`](contracts/deployments/31611.seed.json):
veMEZO shards 930, 931 and 932 (about 33.3 MEZO each), bids from veBTC #1714 and #1715, and the
house gauge on veBTC #1713.

## Repository

| Path | What it is |
|---|---|
| [`contracts/`](contracts) | Foundry. `JanusVault` (veMEZO shards, jMEZO, MUSD rewards) and `BoostMarket` (orders, rounds, settlement), with libraries for the boost formula, epochs, order sorting and vote splitting |
| [`keeper/`](keeper) | TypeScript and viem. Drives rounds, pokes stale boosts, and holds the seed scripts. Its pure planning code is shared with the web app |
| [`web/`](web) | Next.js 14 with wagmi, RainbowKit and Mezo Passport. Pages: Start, Boost, Earn and Market, plus the `/api/starter-kit` route that hands demo accounts their testnet kit |

## Run it locally

You need Foundry, Node 22 and pnpm.

```bash
# Contracts: 125 unit tests
cd contracts
forge build
forge test

# Fork tests against real matsnet NFTs (3 tests)
FOUNDRY_PROFILE=fork FORK_MATSNET=true forge test --isolate --match-path "test/fork/*"
```

```bash
# Keeper: 38 tests. The keeper and the seed scripts read KEEPER_PRIVATE_KEY or
# DEPLOYER_PRIVATE_KEY from a .env file in the repository root.
cd keeper
pnpm install
pnpm test
pnpm start    # run due round steps until the market rests
pnpm watch    # keep running, every KEEPER_INTERVAL_SECONDS (default 300)
pnpm sync     # copy ABIs, the deployment record and shared code into web/
pnpm seed status
pnpm faucet status   # the starter-kit wallet: balances and lock allowances
```

```bash
# Web: 224 tests
cd web
pnpm install
pnpm test
pnpm dev      # http://localhost:3000
pnpm build && pnpm start
```

The starter kit signs with its own wallet, never the owner key. `FAUCET_PRIVATE_KEY` is a
server-only variable (set it in the host's environment; locally it is read from the repository
`.env`). Without it the kit card says the kit is unavailable and everything else works.
`pnpm faucet` in `keeper/` sets that wallet up: `fund [btc]` from the deployer,
`swap [btc] [musd|mezo]`, `quote` and `approve`. veMEZO kits need MEZO from
https://faucet.test.mezo.org, since matsnet has no DEX pool for it.

`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is optional. Without it the app offers injected EVM wallets
and the Mezo Passport Bitcoin wallets.

The seed commands (`pnpm seed <command>` in `keeper/`) rebuild the demo from a funded testnet key:
`quote`, `swap`, `swap-mezo`, `vemezo`, `deposit <tokenId>`, `house [sats]` and
`buyer <label> <sats> <price>`. Each step records what it made in `31611.seed.json`, so reruns skip
finished work.

## Design notes

- **Shards, not a merged lock.** Each deposited veMEZO NFT stays separate and is made permanent, so
  its voting power does not decay. Mezo lets an NFT vote once per epoch on up to 30 gauges, so the
  market sells votes shard by shard.
- **Exact pricing.** Bids are priced with BoostVoter's own integer formula, and the web app runs the
  same math to show the votes and cost before anyone signs.
- **Pay for delivery.** `finalize` charges each buyer for the votes that actually landed on its
  gauge, capped by escrow.
- **No free boost.** Each round resets the shards it sells, and unsold votes go to the house gauge.
- **Pokes are separate.** A poke costs 240k to 410k gas on matsnet, so `finalize` does not poke. The
  keeper pokes any boost that drifted more than 0.01x from what its votes earn.
- **What the owner can do.** Change the fee (at most 20%), the treasury, the house gauge, the minimum
  bid and the minimum shard size, and point the vault at a new market. A market can only vote with
  shards, reset them and add rewards. Nothing lets the owner or a market move a registered shard or
  claimed rewards. `recoverStrayNft` only returns NFTs sent without registering.
- **Limits.** 100 shards, 32 active orders, a 12-hour round timeout and a minimum shard of 1 MEZO.

### Gas on matsnet

Measured on the live deployment with 3 shards and 2 bids.

| Call | Gas used |
|---|---|
| `startRound` | 198,582 |
| `resetShards(10)` | 271,001 |
| `settle` | 417,053 |
| `castVotes(10)` | 1,536,047 |
| `pokeBoosts` (2 NFTs) | 562,007 |

Two things about Mezo's EVM shaped the keeper and the web app. `eth_estimateGas` sometimes returns
only the intrinsic 21,064, so every send pads the estimate by half and retries once at 9.5M gas when
a transaction runs out. And Mezo bills at least half of a transaction's gas limit, so padding is
kept modest instead of always sending at the block limit.

## Tests

| Package | Tests | Coverage |
|---|---|---|
| contracts | 125 unit tests, 3 matsnet fork tests | 98.95% of lines, 90.82% of branches |
| keeper | 38 | |
| web | 224 | 98.88% of lines, 92.55% of branches in `web/src/lib` |

## Planned

These are not built yet.

- Boost forwards: buy a target boost for several epochs at a quoted price.
- veBTC autopilot: re-lock, claim and keep the boost applied without manual steps.
- A jMEZO/MUSD pool with its own gauge.
- Credit gauges: jMEZO votes that direct MUSD liquidity to lending markets, with voters as first loss.

## Status

Testnet software. The contracts are not audited.

## License

MIT. See [LICENSE](LICENSE).
