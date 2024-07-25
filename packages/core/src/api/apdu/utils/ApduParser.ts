import { ApduResponse } from "@api/device-session/ApduResponse";

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
  private _index: number;
  private readonly _response: Uint8Array;

  constructor(response: ApduResponse) {
    this._index = 0;
    this._response = response.data;
  }

  // ==========
  // Public API
  // ==========

  /**
   * Test if the length is greater than the response length
   * @param length: number
   * @returns {boolean} - Returns false if the length is greater than the response length
   */
  testMinimalLength(length: number): boolean {
    return length <= this._response.length;
  }

  /**
   * Extract a single byte from the response
   * @returns {number | undefined} - Returns the byte extracted from the response
   */
  extract8BitUInt(): number | undefined {
    if (this._outOfRange(1)) return;
    return this._response[this._index++];
  }

  /**
   * Extract a 16-bit unsigned integer (Big Endian coding) from the response
   * @returns {number | undefined} - Returns the 16-bit unsigned integer extracted from the response
   */
  extract16BitUInt(): number | undefined {
    if (this._outOfRange(2)) return;
    let msb = this.extract8BitUInt();
    if (msb === undefined) return;
    const lsb = this.extract8BitUInt();
    if (lsb === undefined) return;
    msb *= 0x100;
    return msb + lsb;
  }

  /**
   * Extract a 32-bit unsigned integer (Big Endian coding) from the response
   * @returns {number | undefined} - Returns the 32-bit unsigned integer extracted from the response
   */
  extract32BitUInt(): number | undefined {
    if (this._outOfRange(4)) return;
    let msw = this.extract16BitUInt();
    if (msw === undefined) return;
    const lsw = this.extract16BitUInt();
    if (lsw === undefined) return;
    msw *= 0x10000;
    return msw + lsw;
  }

  /**
   * Extract a field of a specified length from the response
   * @param length: number - The length of the field to extract
   * @returns {Uint8Array | undefined} - Returns the field extracted from the response
   */
  extractFieldByLength(length: number): Uint8Array | undefined {
    if (this._outOfRange(length)) return;
    if (length == 0) return new Uint8Array();
    const field = this._response.slice(this._index, this._index + length);
    this._index += length;
    return field;
  }

  /**
   * Extract a field from the response that is length-value encoded
   * @returns {Uint8Array | undefined} - Returns the field extracted from the response
   */
  extractFieldLVEncoded(): Uint8Array | undefined {
    // extract Length field
    const length = this.extract8BitUInt() ?? -1;
    if (length === -1) return;
    if (length === 0) return new Uint8Array();
    const field = this.extractFieldByLength(length);
    // if the field is inconsistent then roll back to the initial point
    if (!field) this._index--;
    return field;
  }

  /**
   * Extract a field from the response that is tag-length-value encoded
   * @returns {TaggedField | undefined} - Returns the field extracted from the response
   */
  extractFieldTLVEncoded(): TaggedField | undefined {
    if (this._outOfRange(2)) return;

    const tag = this.extract8BitUInt();
    const value = this.extractFieldLVEncoded();

    if (!tag || !value) {
      this._index--;
      return;
    }
    return { tag, value };
  }

  /**
   * Encode a value to a hexadecimal string
   * @param value {Uint8Array} - The value to encode
   * @param prefix {boolean} - Whether to add a prefix to the encoded value
   * @returns {string} - The encoded value as a hexadecimal string
   */
  encodeToHexaString(value?: Uint8Array, prefix?: boolean): string {
    let result = "";
    let index = 0;

    if (!value) return result;

    if (prefix) result += "0x";

    while (index <= value.length) {
      const item = value[index]?.toString(16);
      if (item) result += item.length < 2 ? "0" + item : item;
      index++;
    }
    return result;
  }

  /**
   * Encode a value to an ASCII string
   * @param value {Uint8Array} - The value to encode
   * @returns {string} - The encoded value as an ASCII string
   */
  encodeToString(value?: Uint8Array): string {
    let result = "";
    let index = 0;

    if (!value) return result;

    while (index <= value.length) {
      const item = value[index];
      if (item) result += String.fromCharCode(item);
      index++;
    }

    return result;
  }

  /**
   * Get the current index of the parser
   * @returns {number} - The current index of the parser
   */
  getCurrentIndex(): number {
    return this._index;
  }

  /**
   * Reset the index of the parser to 0
   */
  resetIndex() {
    this._index = 0;
  }

  /**
   * Get the remaining length of the response
   * @returns {number} - The remaining length of the response
   */
  getUnparsedRemainingLength(): number {
    return this._response.length - this._index;
  }

  // ===========
  // Private API
  // ===========

  /**
   * Check whether the expected length is out of range
   * @param length: number
   * @returns {boolean} - Returns true if the expected length is out of range
   */
  private _outOfRange(length: number): boolean {
    return this._index + length > this._response.length;
  }
}
