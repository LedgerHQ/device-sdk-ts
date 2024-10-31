import { bufferToHexaString, type HexaString } from "@api/utils/HexaString";

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
   * Extract a 16-bit unsigned integer from the response
   * @param bigEndian: boolean - True to decode in big endian, false for little endian
   * @returns {number | undefined} - Returns the 16-bit unsigned integer extracted from the response
   */
  extract16BitUInt(bigEndian: boolean = true): number | undefined {
    const value = this.extractNumber(16n, false, bigEndian);
    return value === undefined ? undefined : Number(value);
  }

  /**
   * Extract a 16-bit signed integer from the response
   * @param bigEndian: boolean - True to decode in big endian, false for little endian
   * @returns {number | undefined} - Returns the 16-bit signed integer extracted from the response
   */
  extract16BitInt(bigEndian: boolean = true): number | undefined {
    const value = this.extractNumber(16n, true, bigEndian);
    return value === undefined ? undefined : Number(value);
  }

  /**
   * Extract a 32-bit unsigned integer from the response
   * @param bigEndian: boolean - True to decode in big endian, false for little endian
   * @returns {number | undefined} - Returns the 32-bit unsigned integer extracted from the response
   */
  extract32BitUInt(bigEndian: boolean = true): number | undefined {
    const value = this.extractNumber(32n, false, bigEndian);
    return value === undefined ? undefined : Number(value);
  }

  /**
   * Extract a 32-bit signed integer from the response
   * @param bigEndian: boolean - True to decode in big endian, false for little endian
   * @returns {number | undefined} - Returns the 32-bit signed integer extracted from the response
   */
  extract32BitInt(bigEndian: boolean = true): number | undefined {
    const value = this.extractNumber(32n, true, bigEndian);
    return value === undefined ? undefined : Number(value);
  }

  /**
   * Extract a 64-bit unsigned integer from the response
   * @param bigEndian: boolean - True to decode in big endian, false for little endian
   * @returns {number | undefined} - Returns the 64-bit unsigned integer extracted from the response
   */
  extract64BitUInt(bigEndian: boolean = true): bigint | undefined {
    return this.extractNumber(64n, false, bigEndian);
  }

  /**
   * Extract a 64-bit signed integer from the response
   * @param bigEndian: boolean - True to decode in big endian, false for little endian
   * @returns {number | undefined} - Returns the 64-bit signed integer extracted from the response
   */
  extract64BitInt(bigEndian: boolean = true): bigint | undefined {
    return this.extractNumber(64n, true, bigEndian);
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

  /**
   * Extract a number from the buffer
   * @param sizeInBits: bigint - The number size in bits, for example 16 for a uint16
   * @param signed: boolean - True is the number can be signed and converted to two's compliment
   * @param bigEndian: boolean - True to decode in big endian, false for little endian
   * @returns {bigint | undefined} - Returns the number extracted from the buffer
   */
  private extractNumber(
    sizeInBits: bigint,
    signed: boolean,
    bigEndian: boolean,
  ): bigint | undefined {
    // Check the range
    const sizeInBytes: number = Number(sizeInBits) / 8;
    if (this.outOfRange(sizeInBytes)) return;

    // Compute the number
    let value: bigint = 0n;
    if (bigEndian) {
      for (let i = 0; i < sizeInBytes; i++) {
        value = (value << 8n) | BigInt(this.buffer[i + this.index]!);
      }
    } else {
      for (let i = sizeInBytes - 1; i >= 0; i--) {
        value = (value << 8n) | BigInt(this.buffer[i + this.index]!);
      }
    }

    // Convert the value to two's complement if it is negative
    // https://en.wikipedia.org/wiki/Two%27s_complement
    if (signed) {
      const limit = 1n << (sizeInBits - 1n);
      if (value & limit) {
        value -= limit << 1n;
      }
    }

    this.index += sizeInBytes;
    return value;
  }
}
