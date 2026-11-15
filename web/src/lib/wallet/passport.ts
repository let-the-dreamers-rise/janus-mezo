import { mezoTestnet } from "@mezo-org/orangekit";
import { mezoMainnet } from "@mezo-org/passport/dist/src/constants";
import { IS_MAINNET } from "@/config/network";

/// Mezo Passport, imported file by file. The package index also exports the Passport
/// dropdown, whose UI kit starts a Styletron engine against `document` at import time and
/// breaks static prerendering. Janus renders its own wallet UI, so it takes only the wagmi
/// config, the Bitcoin wallets and the account hook, plus OrangeKit's chain and send hook.
export {
  getConfig,
  okxWalletMezoTestnet,
  unisatWalletMezoTestnet,
  xverseWalletMezoTestnet,
} from "@mezo-org/passport/dist/src/config";
export { useWalletAccount } from "@mezo-org/passport/dist/src/hooks/useWalletAccount";
export {
  okxWalletMezoMainnet,
  unisatWalletMezoMainnet,
  xverseWalletMezoMainnet,
} from "@mezo-org/passport/dist/src/config";
export { useSendTransaction } from "@mezo-org/orangekit";
export { mezoTestnet };

/// The chain this build of the site reads and writes.
export const activeChain = IS_MAINNET ? mezoMainnet : mezoTestnet;
