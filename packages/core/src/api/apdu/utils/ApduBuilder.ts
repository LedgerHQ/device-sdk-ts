import { Apdu } from "@api/apdu/model/Apdu";

import {
  AppBuilderError,
  DataOverflowError,
  HexaStringEncodeError,
  InvalidValueError,
  ValueOverflowError,
} from "./AppBuilderError";

export const HEADER_LENGTH = 5;
export const APDU_MAX_PAYLOAD = 255;
export const APDU_MAX_SIZE = APDU_MAX_PAYLOAD + 5;
const MAX_8_BIT_UINT = 0xff;
const MAX_16_BIT_UINT = 0xffff;
const MAX_32_BIT_UINT = 0xffffffff;

export type ApduBuilderArgs = {
  ins: number;
  cla: number;
  p1: number;
  p2: number;
  offset?: number;
};

/**
 * ApduBuilder is a utility class to help build APDU commands.
 * It allows to easily add data to the data field of the APDU command
 * and to encode this data in different formats.
 *
 * @example
 * ```
 * const apduBuilder = new ApduBuilder({ ins: 0x01, cla: 0x02, p1: 0x03, p2: 0x04 })
 *  .add8BitUIntToData(0x05)
 *  .add16BitUIntToData(0x0607)
 *  .addHexaStringToData("0x0809")
 *  .addAsciiStringToData("hello")
 *
 * const apdu = apduBuilder.build();
 * const builderErrors = apduBuilder.getErrors();
 * ```
 */
export class ApduBuilder {
  private _ins: number;
  private _cla: number;
  private _p1: number;
  private p2: number;
  private data?: Uint8Array;
  private errors: AppBuilderError[] = []; // Custom Error

  constructor({ ins, cla, p1, p2 }: ApduBuilderArgs) {
    this._cla = cla & 0xff;
    this._ins = ins & 0xff;
    this._p1 = p1 & 0xff;
    this.p2 = p2 & 0xff;
  }

  // ==========
  // Public API
  // ==========

  /**
   * Build a new Apdu instance with the current state of the builder
   * @returns {Apdu} - Returns a new Apdu instance
   */
  build = () => new Apdu(this._cla, this._ins, this._p1, this.p2, this.data);

  /**
   * Add a 8-bit unsigned integer to the data field (max value 0xff = 255)
   * @param value?: number - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  add8BitUIntToData = (value?: number) => {
    if (typeof value === "undefined" || isNaN(value)) {
      this.errors?.push(new InvalidValueError("byte", value?.toString()));
      return this;
    }

    if (value > MAX_8_BIT_UINT) {
      this.errors?.push(
        new ValueOverflowError(value.toString(), MAX_8_BIT_UINT),
      );
      return this;
    }

    if ((this.data?.length ?? 0) >= APDU_MAX_PAYLOAD) {
      this.errors?.push(new DataOverflowError(value.toString()));
      return this;
    }

    this.data = Uint8Array.from([...(this.data ?? []), value & 0xff]);
    return this;
  };

  /**
   * Add a 16-bit unsigned integer to the data field (max value 0xffff = 65535)
   * @param value: number - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  add16BitUIntToData = (value: number) => {
    if (value > MAX_16_BIT_UINT) {
      this.errors?.push(
        new ValueOverflowError(value.toString(), MAX_16_BIT_UINT),
      );
      return this;
    }

    if (this.getAvailablePayloadLength() < 4) {
      this.errors?.push(new DataOverflowError(value.toString()));
      return this;
    }

    this.add8BitUIntToData((value >>> 8) & 0xff);
    this.add8BitUIntToData(value & 0xff);
    return this;
  };

  /**
   * Add a 32-bit unsigned integer to the data field (max value 0xffffffff = 4294967295)
   * @param value: number - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  add32BitUIntToData = (value: number) => {
    if (value > MAX_32_BIT_UINT) {
      this.errors?.push(
        new ValueOverflowError(value.toString(), MAX_32_BIT_UINT),
      );
      return this;
    }

    if (this.getAvailablePayloadLength() < 8) {
      this.errors?.push(new DataOverflowError(value.toString()));
      return this;
    }

    this.add8BitUIntToData((value >>> 24) & 0xff);
    this.add8BitUIntToData((value >>> 16) & 0xff);
    this.add8BitUIntToData((value >>> 8) & 0xff);
    this.add8BitUIntToData(value & 0xff);
    return this;
  };

  /**
   * Add a Uint8Array to the data field if it has enough remaining space
   * @param value: Uint8Array - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  addBufferToData = (value: Uint8Array) => {
    if (!this.hasEnoughLengthRemaining(value)) {
      this.errors?.push(new DataOverflowError(value.toString()));
      return this;
    }

    for (const byte of value) {
      this.add8BitUIntToData(byte);
    }
    return this;
  };

  /**
   * Add a string to the data field if it has enough remaining space
   * and it can be formatted as a hexadecimal string
   * @param value: string - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  addHexaStringToData = (value: string) => {
    const result = this.getHexaString(value);
    if (!result.length) {
      this.errors?.push(new HexaStringEncodeError(value));
      return this;
    }
    this.addNumbers(result);
    return this;
  };

  /**
   * Add an ascii string to the data field if it has enough remaining space
   * @param value: string - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  addAsciiStringToData = (value: string) => {
    let hexa = 0;

    if (!this.hasEnoughLengthRemaining(value)) {
      this.errors?.push(new DataOverflowError(value));
      return this;
    }

    for (const char of value) {
      hexa = char.charCodeAt(0);
      this.add8BitUIntToData(hexa);
    }

    return this;
  };

  /**
   * Add a Length-Value encoded hexadecimal string to the data field if it has enough remaining space
   * Length-Value encoding is a way to encode data in a binary format with the first byte
   * being the length of the data and the following bytes being the data itself
   * @param value: string - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  encodeInLVFromHexa = (value: string) => {
    const result: number[] = this.getHexaString(value);

    if (!result.length) {
      this.errors?.push(new HexaStringEncodeError(value));
      return this;
    }

    if (!this.hasEnoughLengthRemaining(value, true)) {
      this.errors?.push(new DataOverflowError(value));
      return this;
    }
    // values are always being well formatted at this point
    // therefore no status test is needed
    this.add8BitUIntToData(result.length);
    this.addNumbers(result);
    return this;
  };

  /**
   * Add a Length-Value encoded buffer to the data field if it has enough remaining space
   * Length-Value encoding is a way to encode data in a binary format with the first byte
   * being the length of the data and the following bytes being the data itself
   * @param value: Uint8Array - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  encodeInLVFromBuffer = (value: Uint8Array) => {
    if (!this.hasEnoughLengthRemaining(value, true)) {
      this.errors?.push(new DataOverflowError(value.toString()));
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
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  encodeInLVFromAscii = (value: string) => {
    if (!this.hasEnoughLengthRemaining(value, true)) {
      this.errors?.push(new DataOverflowError(value));
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
  getAvailablePayloadLength = () => {
    return APDU_MAX_SIZE - (HEADER_LENGTH + (this.data?.length ?? 0));
  };

  /**
   * Returns the hexadecimal representation of a string
   * @param value: string - The value to convert to hexadecimal
   * @returns {number[]} - Returns an array of numbers representing the hexadecimal value
   */
  getHexaString = (value: string) => {
    const table: number[] = [];

    if (!value.length) return [];

    // Hexadecimal are coded on two chars
    if ((value.length & 1) != 0) return [];

    let index = 0;

    // Hexadecimal normally should start with '0x'
    // but some time this prefix is missing
    if (value.startsWith("0x")) {
      index = 2;
    }

    let hexa = 0;
    const ref = /[0-9a-f]{2}/gi;

    while (index < value.length) {
      const piece = value.substring(index, index + 2);
      if (ref.test(piece) == false) return [];
      ref.lastIndex = 0;
      // Attention, parseInt return an integer if the fist char is a number
      // even if the second one is a letter.
      // But the input is already tested and well formatted
      hexa = parseInt(piece, 16);
      table.push(hexa);
      index += 2;
    }

    return table;
  };

  /**
   * Returns the current errors
   * @returns {AppBuilderError[]} - Returns an array of errors
   */
  getErrors = () => this.errors;

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
    hasLv = false,
  ) => {
    return (
      HEADER_LENGTH +
        (this.data?.length ?? 0) +
        value.length +
        (hasLv ? 1 : 0) <=
      APDU_MAX_SIZE
    );
  };

  /**
   * Add an array of numbers to the data field if it has enough remaining space
   * @param value: number[] - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  private addNumbers = (value: number[]) => {
    if (!this.hasEnoughLengthRemaining(value)) {
      this.errors?.push(new DataOverflowError(value.toString()));
      return this;
    }

    for (const byte of value) {
      this.add8BitUIntToData(byte);
    }

    return this;
  };
}
