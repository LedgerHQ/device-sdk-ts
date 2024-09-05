import {
  bufferToHexaString,
  ByteArrayBuilder,
} from "@ledgerhq/device-management-kit";

import { encodeVarint } from "@internal/utils/Varint";

import { PsbtGlobal, PsbtIn, PsbtOut } from "./Psbt";

/**
 * According to specification, key-pair is formatted as:
 * <keylen> <keytype> <keydata> <valuelen> <valuedata>
 * with:
 *   <keylen>: The compact size unsigned integer containing the combined length of <keytype> and <keydata>
 *   <keytype>: A compact size unsigned integer representing the type
 *   <valuelen>: The compact size unsigned integer containing the length of <valuedata>
 * For more informations:
 * https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#specification
 */
export type KeyType = PsbtGlobal | PsbtIn | PsbtOut;

export class Key {
  constructor(
    readonly keyType: KeyType,
    readonly keyData: Uint8Array = new Uint8Array(),
  ) {}

  toHexaString(): string {
    // Safe to extract keyType here since its value is a valid PSBT key type.
    const buffer = new ByteArrayBuilder()
      .addBufferToData(encodeVarint(this.keyType).unsafeCoerce())
      .addBufferToData(this.keyData)
      .build();
    return bufferToHexaString(buffer).slice(2);
  }
}
