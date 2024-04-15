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

type ApduBuilderArgs = {
  ins: number;
  cla: number;
  p1: number;
  p2: number;
  offset?: number;
};

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

  // Public API

  build = () => new Apdu(this._cla, this._ins, this._p1, this.p2, this.data);

  addByteToData = (value?: number) => {
    if (typeof value === "undefined" || isNaN(value)) {
      this.errors?.push(new InvalidValueError("byte", value?.toString()));
      return this;
    }

    if (value > 0xff) {
      this.errors?.push(
        new ValueOverflowError(value.toString(), 255 /* 0xff */),
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

  addShortToData = (value: number) => {
    if (value > 0xffff) {
      this.errors?.push(new ValueOverflowError(value.toString(), 65535));
      return this;
    }

    if (this.getAvailablePayloadLength() < 4) {
      this.errors?.push(new DataOverflowError(value.toString()));
      return this;
    }

    this.addByteToData((value >>> 8) & 0xff);
    this.addByteToData(value & 0xff);
    return this;
  };

  addBufferToData = (value: Uint8Array) => {
    if (!this.hasEnoughLengthRemaining(value)) {
      this.errors?.push(new DataOverflowError(value.toString()));
      return this;
    }

    for (const byte of value) {
      this.addByteToData(byte);
    }
    return this;
  };

  addHexaStringToData = (value: string) => {
    const result = this.getHexaString(value);
    if (!result.length) {
      this.errors?.push(new HexaStringEncodeError(value));
      return this;
    }
    this.addNumbers(result);
    return this;
  };

  addAsciiStringToData = (value: string) => {
    let hexa = 0;

    if (!this.hasEnoughLengthRemaining(value)) {
      this.errors?.push(new DataOverflowError(value));
      return this;
    }

    for (const char of value) {
      hexa = char.charCodeAt(0);
      this.addByteToData(hexa);
    }

    return this;
  };

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
    this.addByteToData(result.length);
    this.addNumbers(result);
    return this;
  };

  encodeInLVFromBuffer = (value: Uint8Array) => {
    if (!this.hasEnoughLengthRemaining(value, true)) {
      this.errors?.push(new DataOverflowError(value.toString()));
      return this;
    }
    // values are always being well formatted at this point
    // therefore no status test is needed
    this.addByteToData(value.length);
    this.addBufferToData(value);
    return this;
  };

  encodeInLVFromAscii = (value: string) => {
    if (!this.hasEnoughLengthRemaining(value, true)) {
      this.errors?.push(new DataOverflowError(value));
      return this;
    }
    // values are always being well formatted at this point
    // therefore no status test is needed
    this.addByteToData(value.length);
    this.addAsciiStringToData(value);
    return this;
  };

  getAvailablePayloadLength = () => {
    return APDU_MAX_SIZE - (HEADER_LENGTH + (this.data?.length ?? 0));
  };

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

  getErrors = () => this.errors;

  // Private API

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

  private addNumbers = (value: number[]) => {
    if (!this.hasEnoughLengthRemaining(value)) {
      this.errors?.push(new DataOverflowError(value.toString()));
      return this;
    }

    for (const byte of value) {
      this.addByteToData(byte);
    }

    return this;
  };
}
