import { hexaStringToBuffer } from "@api/utils/HexaString";

import {
  type AppBuilderError,
  DataOverflowError,
  HexaStringEncodeError,
  ValueOverflowError,
} from "./AppBuilderError";

const MAX_32_BIT_UINT = 0xffffffff;

/**
 * ByteArrayBuilder is a utility class to help build APDU payloads.
 * It allows to easily add data to the payload of an APDU command
 * and to encode this data in different formats.
 *
 * @example
 * ```
 * const builder = new ByteArrayBuilder(255)
 *  .add8BitUIntToData(0x05)
 *  .add16BitUIntToData(0x0607)
 *  .addHexaStringToData("0x0809")
 *  .addAsciiStringToData("hello")
 *
 * const payload = builder.build();
 * const builderErrors = builder.getErrors();
 * ```
 */
export class ByteArrayBuilder {
  private data: Uint8Array = new Uint8Array();
  private readonly errors: AppBuilderError[] = []; // Custom Error

  constructor(private maxPayloadSize: number = MAX_32_BIT_UINT) {}

  // ==========
  // Public API
  // ==========

  /**
   * Build a new payload instance with the current state of the builder
   * @returns {payload} - Returns a new payload instance
   */
  build = (): Uint8Array => this.data;

  /**
   * Try to build a new payload instance with the current state of the builder
   * if the builder don't contain any error.
   * @returns {payload | undefined} - Returns a new payload instance or undefined
   */
  tryBuild = (): Uint8Array | undefined => {
    return this.hasErrors() ? undefined : this.data;
  };

  /**
   * Add a 8-bit unsigned integer to the payload (max value 0xff = 255)
   * @param value: number | bigint - The value to add to the data
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add8BitUIntToData = (value: number | bigint): ByteArrayBuilder => {
    return this.addNumberToData(value, 8n, false, false);
  };

  /**
   * Add a 16-bit unsigned integer to the payload (max value 0xffff = 65535)
   * @param value: number | bigint - The value to add to the data
   * @param bigEndian: boolean - True to encode in big endian, false for little endian
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add16BitUIntToData = (
    value: number | bigint,
    bigEndian: boolean = true,
  ): ByteArrayBuilder => {
    return this.addNumberToData(value, 16n, false, bigEndian);
  };

  /**
   * Add a 32-bit unsigned integer to the payload (max value 0xffffffff = 4294967295)
   * @param value: number | bigint - The value to add to the data
   * @param bigEndian: boolean - True to encode in big endian, false for little endian
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add32BitUIntToData = (
    value: number | bigint,
    bigEndian: boolean = true,
  ): ByteArrayBuilder => {
    return this.addNumberToData(value, 32n, false, bigEndian);
  };

  /**
   * Add a 64-bit unsigned integer to the payload (max value 0xffffffffffffffff = 18446744073709551615)
   * @param value: number | bigint - The value to add to the data
   * @param bigEndian: boolean - True to encode in big endian, false for little endian
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add64BitUIntToData = (
    value: number | bigint,
    bigEndian: boolean = true,
  ): ByteArrayBuilder => {
    return this.addNumberToData(value, 64n, false, bigEndian);
  };

  /**
   * Add a 128-bit unsigned integer to the payload
   * @param value: number | bigint - The value to add to the data
   * @param bigEndian: boolean - True to encode in big endian, false for little endian
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add128BitUIntToData = (
    value: number | bigint,
    bigEndian: boolean = true,
  ): ByteArrayBuilder => {
    return this.addNumberToData(value, 128n, false, bigEndian);
  };

  /**
   * Add a 256-bit unsigned integer to the payload
   * @param value: number | bigint - The value to add to the data
   * @param bigEndian: boolean - True to encode in big endian, false for little endian
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add256BitUIntToData = (
    value: number | bigint,
    bigEndian: boolean = true,
  ): ByteArrayBuilder => {
    return this.addNumberToData(value, 256n, false, bigEndian);
  };

  /**
   * Add a 16-bit signed integer to the payload (value between -0x8000 to 0x7fff)
   * @param value: number | bigint - The value to add to the data
   * @param bigEndian: boolean - True to encode in big endian, false for little endian
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add16BitIntToData = (
    value: number | bigint,
    bigEndian: boolean = true,
  ): ByteArrayBuilder => {
    return this.addNumberToData(value, 16n, true, bigEndian);
  };

  /**
   * Add a 32-bit signed integer to the payload (value between -0x80000000 to 0x7fffffff)
   * @param value: number | bigint - The value to add to the data
   * @param bigEndian: boolean - True to encode in big endian, false for little endian
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add32BitIntToData = (
    value: number | bigint,
    bigEndian: boolean = true,
  ): ByteArrayBuilder => {
    return this.addNumberToData(value, 32n, true, bigEndian);
  };

  /**
   * Add a 64-bit signed integer to the payload (value between -0x8000000000000000 to 0x7fffffffffffffff)
   * @param value: number | bigint - The value to add to the data
   * @param bigEndian: boolean - True to encode in big endian, false for little endian
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add64BitIntToData = (
    value: number | bigint,
    bigEndian: boolean = true,
  ): ByteArrayBuilder => {
    return this.addNumberToData(value, 64n, true, bigEndian);
  };

  /**
   * Add a 128-bit signed integer to the payload
   * @param value: number | bigint - The value to add to the data
   * @param bigEndian: boolean - True to encode in big endian, false for little endian
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add128BitIntToData = (
    value: number | bigint,
    bigEndian: boolean = true,
  ): ByteArrayBuilder => {
    return this.addNumberToData(value, 128n, true, bigEndian);
  };

  /**
   * Add a 256-bit signed integer to the payload
   * @param value: number | bigint - The value to add to the data
   * @param bigEndian: boolean - True to encode in big endian, false for little endian
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add256BitIntToData = (
    value: number | bigint,
    bigEndian: boolean = true,
  ): ByteArrayBuilder => {
    return this.addNumberToData(value, 256n, true, bigEndian);
  };

  /**
   * Add a Uint8Array to the payload if it has enough remaining space
   * @param value: Uint8Array - The value to add to the data
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  addBufferToData = (value: Uint8Array): ByteArrayBuilder => {
    if (!this.hasEnoughLengthRemaining(value)) {
      this.errors.push(new DataOverflowError(value.toString()));
      return this;
    }

    this.data = Uint8Array.from([...this.data, ...value]);
    return this;
  };

  /**
   * Add a string to the payload if it has enough remaining space
   * and it can be formatted as a hexadecimal string
   * @param value: string - The value to add to the data
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  addHexaStringToData = (value: string): ByteArrayBuilder => {
    const result = hexaStringToBuffer(value);
    if (result === null || result.length === 0) {
      this.errors.push(new HexaStringEncodeError(value));
      return this;
    }
    this.addBufferToData(result);
    return this;
  };

  /**
   * Add an ascii string to the data field if it has enough remaining space
   * @param value: string - The value to add to the data
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  addAsciiStringToData = (value: string): ByteArrayBuilder => {
    const bytes = new TextEncoder().encode(value);
    this.addBufferToData(bytes);
    return this;
  };

  /**
   * Add a Length-Value encoded hexadecimal string to the data field if it has enough remaining space
   * Length-Value encoding is a way to encode data in a binary format with the first byte
   * being the length of the data and the following bytes being the data itself
   * @param value: string - The value to add to the data
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  encodeInLVFromHexa = (value: string): ByteArrayBuilder => {
    const result = hexaStringToBuffer(value);
    if (result === null || result.length === 0) {
      this.errors.push(new HexaStringEncodeError(value));
      return this;
    }

    if (!this.hasEnoughLengthRemaining(result, true)) {
      this.errors.push(new DataOverflowError(value));
      return this;
    }
    // values are always being well formatted at this point
    // therefore no status test is needed
    this.add8BitUIntToData(result.length);
    this.addBufferToData(result);
    return this;
  };

  /**
   * Add a Length-Value encoded buffer to the data field if it has enough remaining space
   * Length-Value encoding is a way to encode data in a binary format with the first byte
   * being the length of the data and the following bytes being the data itself
   * @param value: Uint8Array - The value to add to the data
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  encodeInLVFromBuffer = (value: Uint8Array): ByteArrayBuilder => {
    if (!this.hasEnoughLengthRemaining(value, true)) {
      this.errors.push(new DataOverflowError(value.toString()));
      return this;
    }

    this.add8BitUIntToData(value.length);
    this.addBufferToData(value);
    return this;
  };

  /**
   * Add a Length-Value encoded ascii string to the data field if it has enough remaining space
   * Length-Value encoding is a way to encode data in a binary format with the first byte
   * being the length of the data and the following bytes being the data itself
   * @param value: string - The value to add to the data
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  encodeInLVFromAscii = (value: string): ByteArrayBuilder => {
    if (!this.hasEnoughLengthRemaining(value, true)) {
      this.errors.push(new DataOverflowError(value));
      return this;
    }

    this.add8BitUIntToData(value.length);
    this.addAsciiStringToData(value);
    return this;
  };

  /**
   * Add a Tag-Length-Value encoded hexadecimal string to the data field if it has enough remaining space
   * Length-Value encoding is a way to encode data in a binary format with the first byte
   * being the length of the data and the following bytes being the data itself
   * @param tag: number - The tag to add to the data
   * @param value: string - The value to add to the data
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  encodeInTLVFromHexa = (tag: number, value: string): ByteArrayBuilder => {
    this.add8BitUIntToData(tag);
    return this.encodeInLVFromHexa(value);
  };

  /**
   * Add a Tag-Length-Value encoded hexadecimal string to the data field if it has enough remaining space
   * Length-Value encoding is a way to encode data in a binary format with the first byte
   * being the length of the data and the following bytes being the data itself
   * @param tag: number - The tag to add to the data
   * @param value: Uint8Array - The buffer to add to the data
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  encodeInTLVFromBuffer = (
    tag: number,
    value: Uint8Array,
  ): ByteArrayBuilder => {
    this.add8BitUIntToData(tag);
    return this.encodeInLVFromBuffer(value);
  };

  /**
   * Add a Tag-Length-Value encoded uint64 to the data field if it has enough remaining space
   * Length-Value encoding is a way to encode data in a binary format with the first byte
   * being the length of the data and the following bytes being the data itself
   * @param tag: number - The tag to add to the data
   * @param value: number | bigint - The number to add
   * @param bigEndian: boolean - Endianness used to encode the number
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  encodeInTLVFromUInt64 = (
    tag: number,
    value: number | bigint,
    bigEndian: boolean = true,
  ): ByteArrayBuilder => {
    this.add8BitUIntToData(tag);
    this.add8BitUIntToData(8);
    return this.add64BitUIntToData(value, bigEndian);
  };

  /**
   * Returns the remaining payload length
   * @returns {number}
   */
  getAvailablePayloadLength = (): number => {
    return this.maxPayloadSize - this.data.length;
  };

  /**
   * Returns the current errors
   * @returns {AppBuilderError[]} - Returns an array of errors
   */
  getErrors = (): AppBuilderError[] => this.errors;

  /**
   * Verifies if the builder contains errors
   * @returns {boolean} - Returns wether the builder contains errors or not
   */
  hasErrors = (): boolean => this.errors.length !== 0;

  // ===========
  // Private API
  // ===========

  /**
   * Check if there is enough space to add a value to the data field
   * @param value {string | Uint8Array | number[]} - Value to add to the data
   * @param hasLv {boolean} - Length-Value encoding flag
   * @returns {boolean} - Returns true if there is enough space to add the value
   */
  private hasEnoughLengthRemaining = (
    value: string | Uint8Array | number[],
    hasLv: boolean = false,
  ): boolean => {
    return (
      this.data.length + value.length + (hasLv ? 1 : 0) <= this.maxPayloadSize
    );
  };

  /**
   * Add a number to the payload
   * @param value: number | bigint - The value to add to the data
   * @param sizeInBits: bigint - The number size in bits, for example 16 for a uint16
   * @param signed: boolean - Whether the value is signed or unsigned.
   * @param bigEndian: boolean - True to encode in big endian, false for little endian
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  private addNumberToData(
    value: number | bigint,
    sizeInBits: bigint,
    signed: boolean,
    bigEndian: boolean,
  ): ByteArrayBuilder {
    // Convert the number to two's complement and check its bounds
    let converted = this.checkBoundsAndConvert(value, sizeInBits, signed);
    if (converted === undefined) {
      return this;
    }

    // Compute the buffer
    const sizeInBytes = Number(sizeInBits) / 8;
    const buffer = new Uint8Array(sizeInBytes);
    if (bigEndian) {
      for (let i = sizeInBytes - 1; i >= 0; i--) {
        buffer[i] = Number(converted & 0xffn);
        converted >>= 8n;
      }
    } else {
      for (let i = 0; i < sizeInBytes; i++) {
        buffer[i] = Number(converted & 0xffn);
        converted >>= 8n;
      }
    }
    return this.addBufferToData(buffer);
  }

  /**
   * Checks the bounds of a signed or unsigned integer value and converts it to two's complement if it is signed and negative.
   * @param value The value to check and convert.
   * @param sizeInBits The size of the value in bits.
   * @param signed Whether the value is signed or unsigned.
   * @returns The converted value, or null if the value is out of bounds.
   */
  private checkBoundsAndConvert(
    value: number | bigint,
    sizeInBits: bigint,
    signed: boolean,
  ): bigint | undefined {
    // Normalize the value to a bigint
    if (typeof value === "number") {
      if (!Number.isInteger(value) || value > Number.MAX_SAFE_INTEGER) {
        this.errors.push(new ValueOverflowError(value.toString()));
        return;
      }
      value = BigInt(value);
    }

    if (!signed) {
      // Check if the value is within the bounds of an unsigned integer
      const limit = 1n << sizeInBits;
      if (value < 0 || value >= limit) {
        this.errors.push(new ValueOverflowError(value.toString(), limit - 1n));
        return;
      }
    } else {
      // Check if the value is within the bounds of a signed integer
      const limit = 1n << (sizeInBits - 1n);
      if (value >= limit || value < -limit) {
        this.errors.push(new ValueOverflowError(value.toString(), limit - 1n));
        return;
      }

      // Convert the value to two's complement if it is negative
      // https://en.wikipedia.org/wiki/Two%27s_complement
      if (value < 0n) {
        const mask = (1n << sizeInBits) - 1n;
        value = -value;
        value = (~value & mask) + 1n;
      }
    }
    return value;
  }
}
