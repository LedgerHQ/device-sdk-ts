import { Apdu } from "@api/apdu/model/Apdu";

import { AppBuilderError } from "./AppBuilderError";
import { ByteArrayBuilder } from "./ByteArrayBuilder";

export const HEADER_LENGTH = 5;
export const APDU_MAX_PAYLOAD = 255;
export const APDU_MAX_SIZE = APDU_MAX_PAYLOAD + 5;

export type ApduBuilderArgs = {
  readonly ins: number;
  readonly cla: number;
  readonly p1: number;
  readonly p2: number;
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
  private readonly _ins: number;
  private readonly _cla: number;
  private readonly _p1: number;
  private readonly p2: number;
  private data: ByteArrayBuilder = new ByteArrayBuilder(APDU_MAX_PAYLOAD);

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
  build = (): Apdu =>
    new Apdu(this._cla, this._ins, this._p1, this.p2, this.data.build());

  /**
   * Add a 8-bit unsigned integer to the data field (max value 0xff = 255)
   * @param value?: number - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  add8BitUIntToData = (value: number): ApduBuilder => {
    this.data.add8BitUIntToData(value);
    return this;
  };

  /**
   * Add a 16-bit unsigned integer to the data field (max value 0xffff = 65535)
   * @param value: number - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  add16BitUIntToData = (value: number): ApduBuilder => {
    this.data.add16BitUIntToData(value);
    return this;
  };

  /**
   * Add a 32-bit unsigned integer to the data field (max value 0xffffffff = 4294967295)
   * @param value: number - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  add32BitUIntToData = (value: number): ApduBuilder => {
    this.data.add32BitUIntToData(value);
    return this;
  };

  /**
   * Add a Uint8Array to the data field if it has enough remaining space
   * @param value: Uint8Array - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  addBufferToData = (value: Uint8Array): ApduBuilder => {
    this.data.addBufferToData(value);
    return this;
  };

  /**
   * Add a string to the data field if it has enough remaining space
   * and it can be formatted as a hexadecimal string
   * @param value: string - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  addHexaStringToData = (value: string): ApduBuilder => {
    this.data.addHexaStringToData(value);
    return this;
  };

  /**
   * Add an ascii string to the data field if it has enough remaining space
   * @param value: string - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  addAsciiStringToData = (value: string): ApduBuilder => {
    this.data.addAsciiStringToData(value);
    return this;
  };

  /**
   * Add a Length-Value encoded hexadecimal string to the data field if it has enough remaining space
   * Length-Value encoding is a way to encode data in a binary format with the first byte
   * being the length of the data and the following bytes being the data itself
   * @param value: string - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  encodeInLVFromHexa = (value: string): ApduBuilder => {
    this.data.encodeInLVFromHexa(value);
    return this;
  };

  /**
   * Add a Length-Value encoded buffer to the data field if it has enough remaining space
   * Length-Value encoding is a way to encode data in a binary format with the first byte
   * being the length of the data and the following bytes being the data itself
   * @param value: Uint8Array - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  encodeInLVFromBuffer = (value: Uint8Array): ApduBuilder => {
    this.data.encodeInLVFromBuffer(value);
    return this;
  };

  /**
   * Add a Length-Value encoded ascii string to the data field if it has enough remaining space
   * Length-Value encoding is a way to encode data in a binary format with the first byte
   * being the length of the data and the following bytes being the data itself
   * @param value: string - The value to add to the data
   * @returns {ApduBuilder} - Returns the current instance of ApduBuilder
   */
  encodeInLVFromAscii = (value: string): ApduBuilder => {
    this.data.encodeInLVFromAscii(value);
    return this;
  };

  /**
   * Returns the remaining payload length
   * @returns {number}
   */
  getAvailablePayloadLength = (): number =>
    this.data.getAvailablePayloadLength();

  /**
   * Returns the current errors
   * @returns {AppBuilderError[]} - Returns an array of errors
   */
  getErrors = (): AppBuilderError[] => this.data.getErrors();
}
