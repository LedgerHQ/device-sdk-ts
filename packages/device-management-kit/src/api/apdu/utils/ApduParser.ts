import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type HexaString } from "@api/utils/HexaString";

import { ByteArrayParser } from "./ByteArrayParser";

export type TaggedField = {
  readonly tag: number;
  readonly value: Uint8Array;
};

/**
 * ApduParser is a utility class to help parse APDU responses.
 *
 * It provides methods to extract fields of different types from the response.
 *
 * @example
 * ```
 * const parser = new ApduParser(apduResponse);
 * const targetId = parser.encodeToHexaString(parser.extractFieldByLength(4));
 * const seVersion = parser.encodeToString(parser.extractFieldLVEncoded());
 * ```
 */
export class ApduParser {
  private parser: ByteArrayParser;

  constructor(response: ApduResponse) {
    this.parser = new ByteArrayParser(response.data);
  }

  /**
   * Test if the length is greater than the response length
   * @param length: number
   * @returns {boolean} - Returns false if the length is greater than the response length
   */
  testMinimalLength = (length: number): boolean =>
    this.parser.testMinimalLength(length);

  /**
   * Extract a single byte from the response
   * @returns {number | undefined} - Returns the byte extracted from the response
   */
  extract8BitUInt = (): number | undefined => this.parser.extract8BitUInt();

  /**
   * Extract a 16-bit unsigned integer (Big Endian coding) from the response
   * @returns {number | undefined} - Returns the 16-bit unsigned integer extracted from the response
   */
  extract16BitUInt = (): number | undefined => this.parser.extract16BitUInt();

  /**
   * Extract a 32-bit unsigned integer (Big Endian coding) from the response
   * @returns {number | undefined} - Returns the 32-bit unsigned integer extracted from the response
   */
  extract32BitUInt = (): number | undefined => this.parser.extract32BitUInt();

  /**
   * Extract a field of a specified length from the response
   * @param length: number - The length of the field to extract
   * @returns {Uint8Array | undefined} - Returns the field extracted from the response
   */
  extractFieldByLength = (length: number): Uint8Array | undefined =>
    this.parser.extractFieldByLength(length);

  /**
   * Extract a field from the response that is length-value encoded
   * @returns {Uint8Array | undefined} - Returns the field extracted from the response
   */
  extractFieldLVEncoded = (): Uint8Array | undefined =>
    this.parser.extractFieldLVEncoded();

  /**
   * Extract a field from the response that is tag-length-value encoded
   * @returns {TaggedField | undefined} - Returns the field extracted from the response
   */
  extractFieldTLVEncoded = (): TaggedField | undefined =>
    this.parser.extractFieldTLVEncoded();

  /**
   * Encode a value to a hexadecimal string
   * @param value {Uint8Array} - The value to encode
   * @param prefix {boolean} - Whether to add a prefix to the encoded value
   * @returns {string} - The encoded value as a hexadecimal string
   */
  encodeToHexaString(value?: Uint8Array, prefix?: false): string;
  encodeToHexaString(value?: Uint8Array, prefix?: true): HexaString;
  encodeToHexaString(
    value?: Uint8Array,
    prefix: boolean = false,
  ): HexaString | string {
    return prefix
      ? this.parser.encodeToHexaString(value, true)
      : this.parser.encodeToHexaString(value, false);
  }

  /**
   * Encode a value to an ASCII string
   * @param value {Uint8Array} - The value to encode
   * @returns {string} - The encoded value as an ASCII string
   */
  encodeToString = (value?: Uint8Array): string =>
    this.parser.encodeToString(value);

  /**
   * Get the remaining length of the response
   * @returns {number} - The remaining length of the response
   */
  getUnparsedRemainingLength = (): number =>
    this.parser.getUnparsedRemainingLength();
}
