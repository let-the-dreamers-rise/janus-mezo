import { boostMarketAbi, janusVaultAbi } from "@/lib/abi/janus";
import { boostVoterAbi, erc20Abi, votingEscrowAbi } from "@/lib/abi/mezo";
import { DEPLOYMENT } from "@/config/deployment";
import { MEZO_MATSNET } from "@/config/mezo-addresses";

export const vaultContract = { address: DEPLOYMENT.vault, abi: janusVaultAbi } as const;
export const marketContract = { address: DEPLOYMENT.market, abi: boostMarketAbi } as const;
export const voterContract = { address: DEPLOYMENT.boostVoter, abi: boostVoterAbi } as const;
export const veMezoContract = { address: DEPLOYMENT.veMezo, abi: votingEscrowAbi } as const;
export const veBtcContract = { address: DEPLOYMENT.veBtc, abi: votingEscrowAbi } as const;
export const musdContract = { address: DEPLOYMENT.musd, abi: erc20Abi } as const;
export const mezoTokenContract = { address: MEZO_MATSNET.mezoToken, abi: erc20Abi } as const;
export const BOOST_GAUGE_FACTORY = MEZO_MATSNET.boostGaugeFactory;
