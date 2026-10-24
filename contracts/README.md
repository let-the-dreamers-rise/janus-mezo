# Janus contracts

Foundry project for the two Janus contracts. See the [repository README](../README.md) for what
Janus does and how a round works.

| File | Role |
|---|---|
| `src/JanusVault.sol` | Holds veMEZO NFTs as separate, permanent vote shards and mints jMEZO 1:1 against their MEZO. Accrues MUSD rewards to jMEZO holders |
| `src/BoostMarket.sol` | Runs rounds: snapshot, reset, settle, vote, finalize. Every step is permissionless |
| `src/market/BoostOrders.sol` | Orders: escrowed MUSD bids per veBTC NFT, top-ups, changes and cancels |
| `src/libraries/BoostMath.sol` | BoostVoter's boost formula and its inverse: the votes a gauge needs for a target boost |
| `src/libraries/Epochs.sol` | Mezo's weekly epochs and vote window |
| `src/libraries/OrderSort.sol` | Price-then-id ordering of bids |
| `src/libraries/VoteSplitter.sol` | Splits an allocation across shards within the 30-gauge vote limit |
| `script/Deploy.s.sol` | Deploys both contracts against Mezo's live contracts and writes `deployments/<chainId>.json` |

## Build and test

```bash
forge build
forge test
forge coverage --report summary --no-match-coverage "(test|script)/"
```

The default profile compiles for Paris, so the bytecode runs on any Mezo node. The fork tests run
Mezo's own Osaka-compiled veMEZO, so they use the `fork` profile:

```bash
FOUNDRY_PROFILE=fork FORK_MATSNET=true forge test --isolate --match-path "test/fork/*"
```

`test/fork/data/matsnet-nfts.json` pins the real matsnet NFTs and block those tests use. Refresh it
with `pnpm scan:nfts` in `keeper/`.

## Deploy

```bash
forge script script/Deploy.s.sol --rpc-url matsnet --broadcast
```

The script reads `DEPLOYER_PRIVATE_KEY` from the environment and never logs it. `JANUS_TREASURY`
is optional and defaults to the deployer. Set the house fallback gauge afterwards with
`setFallbackGauge`, once the treasury's veBTC NFT has a boost gauge; `pnpm seed house` in `keeper/`
does this.
