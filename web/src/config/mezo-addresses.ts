// Generated from keeper/src/config/addresses.ts by keeper/scripts/sync-artifacts.ts. Do not edit by hand.
import type { Address } from "viem";

/// Mezo protocol contracts on matsnet (chain id 31611). Proxies, not implementations.
export const MEZO_MATSNET = {
  boostVoter: "0x21d7bDF5a5929AD179F8cA0c9014A0B62ae6Bfd1",
  veMezo: "0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b",
  veBtc: "0x38E35d92E6Bfc6787272A62345856B13eA12130a",
  factoryRegistry: "0x93915fF0ddEd1bfD587ef996Ee91504ab97E95Cf",
  musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  mezoToken: "0x7B7c000000000000000000000000000000000001",
  btcToken: "0x7b7C000000000000000000000000000000000000",
  /// Gauge factory BoostVoter.createBoostGauge is called with (decoded from live txs).
  boostGaugeFactory: "0x2c015840D034fE74BEA8C62Dd00A11e3aa338aD5",
  dexRouter: "0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9",
  dexFactory: "0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A",
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
} as const satisfies Record<string, Address>;

/// Janus contracts. Filled in by the deploy script output (see contracts/deployments).
export type JanusAddresses = {
  vault: Address;
  market: Address;
};
