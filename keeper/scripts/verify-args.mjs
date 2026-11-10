// Prints ABI-encoded constructor args for `forge verify-contract`.
// Usage: node scripts/verify-args.mjs <vault|market> <deployment.json>
import { readFileSync } from "node:fs";
import { encodeAbiParameters, parseAbiParameters } from "viem";

const [kind, file] = process.argv.slice(2);
const d = JSON.parse(readFileSync(file, "utf8"));
const MIN_SHARD = 10n ** 18n;
const MIN_PRICE = 10n ** 12n;
const FEE_BPS = 1000n;

const args =
  kind === "vault"
    ? encodeAbiParameters(parseAbiParameters("address, address, address, address, uint256"), [d.veMezo, d.boostVoter, d.musd, d.owner, MIN_SHARD])
    : encodeAbiParameters(parseAbiParameters("(address,address,address,address,address,address,address,uint256,uint256)"), [
        [d.vault, d.boostVoter, d.veMezo, d.veBtc, d.musd, d.treasury, d.owner, MIN_PRICE, FEE_BPS],
      ]);
process.stdout.write(args);
