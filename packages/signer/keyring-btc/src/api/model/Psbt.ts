import { Psbt as BitcoinJsPsbt } from "bitcoinjs-lib";

/**
 * A PSBT in any version:
 * - V1: https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki
 * - V2: https://github.com/bitcoin/bips/blob/master/bip-0370.mediawiki
 * Can be in severail formats:
 * - serialized buffer
 * - hexadecimal string
 * - base64 string
 * - bitcoin-js Psbt
 */
export type Psbt = string | Uint8Array | BitcoinJsPsbt;
