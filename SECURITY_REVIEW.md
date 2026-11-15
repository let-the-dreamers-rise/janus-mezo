# Janus security review (internal)

Date: 15 November 2026. Reviewer: the Janus team, with AI-assisted review. This is an internal
review, not an independent audit. An external audit is a condition for raising the mainnet
deposit cap (see Roadmap).

## Scope

Contracts as deployed on Mezo mainnet (chain 31612), commit `e2cc6a6`:

| Contract | Address | Source |
| --- | --- | --- |
| JanusVault (jMEZO) | `0xDC1db035D17356Fc4aADd9cdB80F264512DA2879` | `contracts/src/JanusVault.sol`, `vault/JanusRewards.sol` |
| BoostMarket | `0x9098b6f514f322A6f57501cdd92e7aBf79E41870` | `contracts/src/BoostMarket.sol`, `market/BoostOrders.sol` |
| Libraries | linked | `BoostMath`, `VoteSplitter`, `OrderSort`, `Epochs` |

Both contracts are verified on explorer.mezo.org. External dependencies were checked against
Mezo's verified sources: BoostVoter (proxy `0x2Ba6...13d1`, implementation `0xa696...7624`),
veMEZO and veBTC.

## Method

- Line-by-line read of all in-scope code, focused on fund custody, share accounting, round
  state transitions, try/catch gas griefing, reward streaming and owner powers.
- Checked Mezo's BoostVoter behaviour the design relies on: `reset` and `vote` revert for a
  token that already voted this epoch (`onlyNewEpoch`), and `pokeBoost` is permissionless.
- 179 unit and property tests (`forge test`), 98% line coverage, plus a Matsnet fork suite.
- End-to-end rounds on Matsnet, including round 1 of the v2 market on 15 November 2026
  (2 orders filled, 106.7 votes, 3.60 MUSD charged, 3.24 MUSD to jMEZO holders).

## Summary

No critical or high findings. Two medium findings, both mitigated without a redeploy. The
low and informational items are design trade-offs, documented here so users can see them.

| ID | Severity | Title | Status |
| --- | --- | --- | --- |
| M-1 | Medium | Owner is a single hot key | Mitigated by caps; multisig planned |
| M-2 | Medium | Shard slots could be filled with dust deposits | Fixed on-chain |
| L-1 | Low | Shards can be redeemed while fills are being poked | Accepted |
| L-2 | Low | A buyer who can make its own poke revert is not charged | Accepted |
| L-3 | Low | Fee can change without a delay, up to the 20% hard cap | Planned |
| L-4 | Low | A jMEZO pool must be excluded from rewards before it holds jMEZO | Runbook |
| I-1 | Info | Share rounding on deposit | Accepted |
| I-2 | Info | Depositing makes a veMEZO lock permanent | Disclosed in the app |
| I-3 | Info | Mezo's BoostVoter is upgradeable by Mezo | External dependency |

## Findings

### M-1 Owner is a single hot key

Both contracts are owned by one externally owned account. The owner cannot move shards out of
the vault (`recoverStrayNft` refuses registered shards) or take buyer escrow (escrow lives in
the market and only buyers or the round logic move it). It can, however, point the vault at a
new market with `setMarket`, which would let that market direct the vault's votes, and it can
set the fee up to 20%.

Mitigation: deposits are capped at 1,000 MEZO and shards cannot be stolen, so the worst case
is misdirected votes for one epoch. Both contracts use `Ownable2Step`, so ownership can move
to a Safe multisig without a redeploy. Planned before the cap is raised.

### M-2 Shard slots could be filled with dust deposits

The vault holds at most 100 shards so every round fits in a block. With the deploy-time
minimum of 1 MEZO, anyone could fill all 100 slots for about 100 MEZO and block other
depositors until those shards were redeemed.

Fixed: `setMinShardAmount(10 MEZO)` in tx
`0xcfcf29b3b5b0a2d1d1f132d146055412a5c7d3b46c819d1f90b366b4a3bf07f5`. With the 1,000 MEZO
cap, 100 shards of 10 MEZO already reach the cap, so dust can no longer exhaust slots. When the
cap rises, the minimum rises with it (minimum at least cap / 100).

### L-1 Shards can be redeemed while fills are being poked

`shardsLocked` covers the Resetting to Voting phases, so a shard can be redeemed during
Poking. The redeemer cannot remove the sold votes, because BoostVoter rejects `reset` and
`vote` for a token that voted this epoch. They could only call `poke` after unlocking the
lock's permanent status, which lowers its weight by a negligible decay within the round.
Accepted.

### L-2 A buyer who can make its own poke revert is not charged

`pokeFills` catches a failing `pokeBoost` so one bad NFT cannot block a round, and a fill is
charged only when its boost was applied. A buyer able to force that revert would receive votes
on its gauge without paying for that round. We found no way to force it on Mezo's current
BoostVoter, and the gas checks (`MIN_POKE_GAS`) stop the keeper from starving the call.
Accepted, monitored through `BoostPokeFailed` events.

### L-3 Fee can change without a delay

`setFeeBps` takes effect immediately, bounded by the hard cap `MAX_FEE_BPS = 2,000` (20%).
Planned: a timelock on fee and market changes alongside the multisig.

### L-4 Pool exclusion order

A jMEZO liquidity pool must be passed to `excludeFromRewards` before it holds any jMEZO,
otherwise it earns rewards its LPs can never claim. This is a runbook step in `MAINNET.md`
and was followed for the Matsnet pool.

### I-1 Share rounding on deposit

Shares round down for depositors and redemption cost rounds up, so rounding always favours
the vault. Donating MEZO to a shard's lock raises every holder's share, so the classic
first-depositor inflation attack costs the attacker more than it takes.

### I-2 Permanent locks

Deposited veMEZO is made permanent so its voting power does not decay. A user who redeems a
shard receives a permanent lock and must unlock it in the Mezo app before it can expire.

### I-3 Upgradeable dependency

BoostVoter is a Mezo-controlled upgradeable proxy. Janus checks gauge liveness and boosts on
every round, and a change to `reset`, `vote` or `pokeBoost` semantics would require a review.

## Roadmap to raise the cap

1. Move ownership of both contracts to a Safe multisig.
2. Add a timelock for fee and market changes.
3. Independent external audit.
4. Raise the cap in steps, with the minimum shard size kept at least cap / 100.
