import { hexaStringToBuffer } from "@api/utils/HexaString";

import {
  AppBuilderError,
  DataOverflowError,
  HexaStringEncodeError,
  ValueOverflowError,
} from "./AppBuilderError";

const MAX_8_BIT_UINT = 0xff;
const MAX_16_BIT_UINT = 0xffff;
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

  constructor(private maxPayloadSize: number) {}

  // ==========
  // Public API
  // ==========

  /**
   * Build a new payload instance with the current state of the builder
   * @returns {payload} - Returns a new payload instance
   */
  build = (): Uint8Array => this.data;

  /**
   * Add a 8-bit unsigned integer to the payload (max value 0xff = 255)
   * @param value: number - The value to add to the data
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add8BitUIntToData = (value: number): ByteArrayBuilder => {
    if (value > MAX_8_BIT_UINT) {
      this.errors.push(
        new ValueOverflowError(value.toString(), MAX_8_BIT_UINT),
      );
      return this;
    }

    if (this.data.length >= this.maxPayloadSize) {
      this.errors.push(new DataOverflowError(value.toString()));
      return this;
    }

    this.data = Uint8Array.from([...this.data, value & 0xff]);
    return this;
  };

  /**
   * Add a 16-bit unsigned integer to the payload (max value 0xffff = 65535)
   * @param value: number - The value to add to the data
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add16BitUIntToData = (value: number): ByteArrayBuilder => {
    if (value > MAX_16_BIT_UINT) {
      this.errors.push(
        new ValueOverflowError(value.toString(), MAX_16_BIT_UINT),
      );
      return this;
    }

    if (this.getAvailablePayloadLength() < 2) {
      this.errors.push(new DataOverflowError(value.toString()));
      return this;
    }

    this.add8BitUIntToData((value >>> 8) & 0xff);
    this.add8BitUIntToData(value & 0xff);
    return this;
  };

  /**
   * Add a 32-bit unsigned integer to the payload (max value 0xffffffff = 4294967295)
   * @param value: number - The value to add to the data
   * @returns {ByteArrayBuilder} - Returns the current instance of ByteArrayBuilder
   */
  add32BitUIntToData = (value: number): ByteArrayBuilder => {
    if (value > MAX_32_BIT_UINT) {
      this.errors.push(
        new ValueOverflowError(value.toString(), MAX_32_BIT_UINT),
      );
      return this;
    }

    if (this.getAvailablePayloadLength() < 4) {
      this.errors.push(new DataOverflowError(value.toString()));
      return this;
    }

    this.add8BitUIntToData((value >>> 24) & 0xff);
    this.add8BitUIntToData((value >>> 16) & 0xff);
    this.add8BitUIntToData((value >>> 8) & 0xff);
    this.add8BitUIntToData(value & 0xff);
    return this;
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
}