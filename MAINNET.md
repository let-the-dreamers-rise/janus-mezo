# Janus mainnet launch

Mezo mainnet is chain 31612. Contracts are unaudited, so the launch is capped.
Run commands from the folder each step names. Nothing here needs a key on a server.

## Timing

Votes are weekly. An epoch starts Thursday 00:00 UTC, and voting runs from one hour after
the start to one hour before the end. One round fits in each epoch.

| Epoch | Voting closes | Round |
|---|---|---|
| Nov 5 to Nov 12 | Wed Nov 11 23:00 UTC | Round 1, only if the deploy and deposit finish in time |
| Nov 12 to Nov 19 | Wed Nov 18 23:00 UTC | Round 2, opens Thu Nov 12 01:00 UTC |

The Wave 2 deadline is Nov 15, so a round must finish before then to count as evidence.

## 1. Owner prepares

These move real funds, so the owner does them from their own wallet.

- Send BTC on Mezo to the deployer `0x8f78545c43124dEfb1aF52f03c6F4782C905Cb5C`.
  0.0005 BTC covers the deploy (about 0.000012 BTC), pool creation and several rounds of keeper gas.
- Choose the treasury address that receives the 10% fee.
- Choose the deposit cap in MEZO.
- Choose the fallback gauge, which takes any votes bids do not buy. It must be a live boost gauge.
  The owner's own veBTC gauge keeps that boost in-house. Any other live gauge works but
  hands the unsold boost to its owner.

Add to the repo `.env`, with the cap in 18-decimal units (1,000 MEZO is `1000000000000000000000`):

```
JANUS_TREASURY=0x...
JANUS_DEPOSIT_CAP=1000000000000000000000
```

## 2. Deploy (from `keeper/`)

Get the go-ahead first. This spends real BTC and cannot be undone.

```bash
node scripts/deploy.mjs mezo --confirm-mainnet
```

This writes `contracts/deployments/31612.json`.

## 3. Verify on the explorer (from `contracts/`)

Get the constructor arguments from `keeper/`:

```bash
node scripts/verify-args.mjs vault ../contracts/deployments/31612.json
```

```bash
node scripts/verify-args.mjs market ../contracts/deployments/31612.json
```

Then verify each contract with its arguments:

```bash
forge verify-contract <vault> src/JanusVault.sol:JanusVault --verifier blockscout --verifier-url https://api.explorer.mezo.org/api/ --chain 31612 --constructor-args <hex> --watch
```

```bash
forge verify-contract <market> src/BoostMarket.sol:BoostMarket --verifier blockscout --verifier-url https://api.explorer.mezo.org/api/ --chain 31612 --constructor-args <hex> --watch
```

## 4. Set the fallback gauge

Call `setFallbackGauge(gauge)` on the market from the deployer. `settle` reverts until this is set.

## 5. Point the site at mainnet

From `keeper/`, run `pnpm sync` to copy the record into the web app. Then set
`NEXT_PUBLIC_JANUS_NETWORK=mainnet` in Vercel production and redeploy. Do this only after
step 2: the mainnet build says "Live on Mezo Mainnet" on the home page.

On mainnet the site drops the demo wallet, starter kit, tour and read-only demo account.
Removing the variable and redeploying returns the site to Matsnet.

## 6. Fill the vault and the pool

The owner does these from their own wallet on the live site.

- Lock MEZO to veMEZO and deposit into the vault. This mints jMEZO.
- Bid from a second wallet or, better, have real testers bid. Bidding needs a veBTC lock with a boost gauge.

The pool needs both jMEZO and MUSD. Check it first, then create and seed it with amounts in
whole tokens (from `keeper/`). The seed amounts set the opening price. These commands use
Git Bash syntax. In PowerShell, run `$env:JANUS_NETWORK='mainnet'` first and drop the prefix.

```bash
JANUS_NETWORK=mainnet pnpm pool status
```

```bash
JANUS_NETWORK=mainnet pnpm pool create
```

```bash
JANUS_NETWORK=mainnet pnpm pool seed <jmezo> <musd>
```

## 7. Run a round (from `keeper/`)

The deployer key signs by default. `KEEPER_PRIVATE_KEY` overrides it.

```bash
JANUS_NETWORK=mainnet pnpm start
```

Every step is permissionless, so the "Run next step" button on the site also works.

## 8. Update the evidence

- Add the mainnet transactions to `web/src/lib/proof/evidence.ts` and change the
  "Everything here runs on Matsnet testnet" line in `web/src/components/proof/proof-view.tsx`.
- Update the README, deck and form with the mainnet addresses.
- Count only wallets that are not ours as third parties.

## Known limits at launch

- The contracts are unaudited. Keep the cap small.
- The owner stays the deployer key. Move it to a multisig before raising the cap.
- A bribe token that was never registered cannot be swept out of the vault.
