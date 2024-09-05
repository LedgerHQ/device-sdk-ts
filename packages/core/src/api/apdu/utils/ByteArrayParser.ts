import { bufferToHexaString, HexaString } from "@api/utils/HexaString";

export type TaggedField = {
  readonly tag: number;
  readonly value: Uint8Array;
};

/**
 * ByteArrayParser is a utility class to help parse a byte array.
 *
 * It provides methods to extract fields of different types from the buffer.
 *
 * @example
 * ```
 * const parser = new ByteArrayParser(buffer);
 * const targetId = parser.encodeToHexaString(parser.extractFieldByLength(4));
 * const seVersion = parser.encodeToString(parser.extractFieldLVEncoded());
 * ```
 */
export class ByteArrayParser {
  private index: number = 0;

  constructor(private readonly buffer: Uint8Array) {}

  // ==========
  // Public API
  // ==========

  /**
   * Test if the length is greater than the response length
   * @param length: number
   * @returns {boolean} - Returns false if the length is greater than the response length
   */
  testMinimalLength(length: number): boolean {
    return length <= this.buffer.length - this.index;
  }

  /**
   * Extract a single byte from the response
   * @returns {number | undefined} - Returns the byte extracted from the response
   */
  extract8BitUInt(): number | undefined {
    if (this.outOfRange(1)) return;
    return this.buffer[this.index++];
  }

  /**
   * Extract a 16-bit unsigned integer (Big Endian coding) from the response
   * @returns {number | undefined} - Returns the 16-bit unsigned integer extracted from the response
   */
  extract16BitUInt(): number | undefined {
    if (this.outOfRange(2)) return;
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
    if (this.outOfRange(4)) return;
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
    if (this.outOfRange(length)) return;
    if (length === 0) return new Uint8Array();
    const field = this.buffer.slice(this.index, this.index + length);
    this.index += length;
    return field;
  }

  /**
   * Extract a field from the response that is length-value encoded
   * @returns {Uint8Array | undefined} - Returns the field extracted from the response
   */
  extractFieldLVEncoded(): Uint8Array | undefined {
    // extract Length field
    const length = this.extract8BitUInt();
    if (length === undefined) return;
    else if (length === 0) return new Uint8Array();
    const field = this.extractFieldByLength(length);
    // if the field is inconsistent then roll back to the initial point
    if (field === undefined) this.index--;
    return field;
  }

  /**
   * Extract a field from the response that is tag-length-value encoded
   * @returns {TaggedField | undefined} - Returns the field extracted from the response
   */
  extractFieldTLVEncoded(): TaggedField | undefined {
    if (this.outOfRange(2)) return;

    const tag = this.extract8BitUInt();
    const value = this.extractFieldLVEncoded();

    if (tag === undefined || value === undefined) {
      this.index--;
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
  encodeToHexaString(value?: Uint8Array, prefix?: false): string;
  encodeToHexaString(value?: Uint8Array, prefix?: true): HexaString;
  encodeToHexaString(
    value?: Uint8Array,
    prefix: boolean = false,
  ): HexaString | string {
    if (value === undefined || value.length === 0) return "";
    const result = bufferToHexaString(value);
    return prefix ? result : result.slice(2);
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
    return this.index;
  }

  /**
   * Reset the index of the parser to 0
   */
  resetIndex() {
    this.index = 0;
  }

  /**
   * Get the remaining length of the response
   * @returns {number} - The remaining length of the response
   */
  getUnparsedRemainingLength(): number {
    return this.buffer.length - this.index;
  }

  // ===========
  // Private API
  // ===========

  /**
   * Check whether the expected length is out of range
   * @param length: number
   * @returns {boolean} - Returns true if the expected length is out of range
   */
  private outOfRange(length: number): boolean {
    return this.index + length > this.buffer.length;
  }
}
