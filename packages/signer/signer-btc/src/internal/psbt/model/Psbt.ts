import { Maybe } from "purify-ts";

import { Key } from "./Key";
import { type Value } from "./Value";

// Global map keyTypes as specified here:
// https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#specification
// Un-needed keys are not present
export enum PsbtGlobal {
  UNSIGNED_TX = 0x00,
  XPUB = 0x01,
  TX_VERSION = 0x02,
  FALLBACK_LOCKTIME = 0x03,
  INPUT_COUNT = 0x04,
  OUTPUT_COUNT = 0x05,
  TX_MODIFIABLE = 0x06,
  VERSION = 0xfb,
}

// Inputs map keyTypes as specified here:
// https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#specification
// Un-needed keys are not present
export enum PsbtIn {
  NON_WITNESS_UTXO = 0x00,
  WITNESS_UTXO = 0x01,
  PARTIAL_SIG = 0x02,
  SIGHASH_TYPE = 0x03,
  REDEEM_SCRIPT = 0x04,
  WITNESS_SCRIPT = 0x05,
  BIP32_DERIVATION = 0x06,
  FINAL_SCRIPTSIG = 0x07,
  FINAL_SCRIPTWITNESS = 0x08,
  POR_COMMITMENT = 0x09,
  RIPEMD160 = 0x0a,
  SHA256 = 0x0b,
  HASH160 = 0x0c,
  HASH256 = 0x0d,
  PREVIOUS_TXID = 0x0e,
  OUTPUT_INDEX = 0x0f,
  SEQUENCE = 0x10,
  REQUIRED_TIME_LOCKTIME = 0x11,
  REQUIRED_HEIGHT_LOCKTIME = 0x12,
  TAP_KEY_SIG = 0x13,
  TAP_SCRIPT_SIG = 0x14,
  TAP_LEAF_SCRIPT = 0x15,
  TAP_BIP32_DERIVATION = 0x16,
  TAP_INTERNAL_KEY = 0x17,
  TAP_MERKLE_ROOT = 0x18,
  MUSIG2_PARTICIPANT_PUBKEYS = 0x1a,
  MUSIG2_PUB_NONCE = 0x1b,
  MUSIG2_PARTIAL_SIG = 0x1c,
}

// Outputs map keyTypes as specified here:
// https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#specification
// Un-needed keys are not present
export enum PsbtOut {
  REDEEM_SCRIPT = 0x00,
  WITNESS_SCRIPT = 0x01,
  BIP_32_DERIVATION = 0x02,
  AMOUNT = 0x03,
  SCRIPT = 0x04,
  TAP_INTERNAL_KEY = 0x05,
  TAP_TREE = 0x06,
  TAP_BIP32_DERIVATION = 0x07,
  MUSIG2_PARTICIPANT_PUBKEYS = 0x08,
  DNSSEC_PROOF = 0x35,
}

/**
 * A PSBT is composed of a global map, and a map per input and per output, as specified here:
 * https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#specification
 *
 * Keys of the maps are the hexadecimal string representations of PSBT keys defined as:
 * <keytype> <keydata>
 * The class Key has a helper function toHexaString() which can be used to access
 * a value of those maps.
 * Otherwise, getGlobalValue, getInputValue, getOutputValue can be used for a higher
 * level representation.
 */
export class Psbt {
  constructor(
    public globalMap: Map<string, Value> = new Map(),
    public inputMaps: Map<string, Value>[] = [],
    public outputMaps: Map<string, Value>[] = [],
  ) {}

  getGlobalValue(key: PsbtGlobal): Maybe<Value> {
    return Maybe.fromNullable(this.globalMap.get(new Key(key).toHexaString()));
  }

  getInputValue(inputIndex: number, key: PsbtIn): Maybe<Value> {
    return Maybe.fromNullable(this.inputMaps[inputIndex]).chain((input) =>
      Maybe.fromNullable(input.get(new Key(key).toHexaString())),
    );
  }

  getOutputValue(outputIndex: number, key: PsbtOut): Maybe<Value> {
    return Maybe.fromNullable(this.outputMaps[outputIndex]).chain((output) =>
      Maybe.fromNullable(output.get(new Key(key).toHexaString())),
    );
  }

  setGlobalValue(key: PsbtGlobal, value: Value) {
    this.globalMap.set(new Key(key).toHexaString(), value);
  }

  setInputValue(inputIndex: number, key: PsbtIn, value: Value) {
    this.inputMaps[inputIndex]?.set(new Key(key).toHexaString(), value);
  }

  setOutputValue(outputIndex: number, key: PsbtOut, value: Value) {
    this.outputMaps[outputIndex]?.set(new Key(key).toHexaString(), value);
  }
}
