import { ApduResponse } from "@internal/device-session/model/ApduResponse";

export type TaggedField = {
  tag: number;
  value: Uint8Array;
};

export class ApduParser {
  private _index: number;
  private _response: Uint8Array;

  constructor(response: ApduResponse) {
    this._index = 0;
    this._response = response.data;
  }

  // Public API
  testMinimalLength = (length: number) => {
    if (length > this._response.length) return false;
    return true;
  };

  extract8BitUint = () => {
    if (!this.testLength(1)) return undefined;
    return this._response[this._index++];
  };

  extract16BitUInt = () => {
    if (!this.testLength(2)) return undefined;
    let msb = this.extract8BitUint();
    if (!msb) return undefined;
    const lsb = this.extract8BitUint();
    if (!lsb) return undefined;
    msb *= 0x100;
    return msb + lsb;
  };

  extract32BitUInt = () => {
    if (!this.testLength(4)) return undefined;
    let msw = this.extract16BitUInt();
    if (!msw) return undefined;
    const lsw = this.extract16BitUInt();
    if (!lsw) return undefined;
    msw *= 0x10000;
    return msw + lsw;
  };

  extractFieldDirect = (length: number) => {
    if (!this.testLength(length)) return undefined;
    if (length == 0) return new Uint8Array();
    const field = this._response.slice(this._index, this._index + length);
    this._index += length;
    return field;
  };

  extractFieldLVEncoded = () => {
    // extract Length field
    const length = this.extract8BitUint();
    if (length == 0) return new Uint8Array();
    if (!length) return undefined;
    const field = this.extractFieldDirect(length);

    // if the field is inconsistent then roll back to the initial point
    if (!field) this._index--;
    return field;
  };

  extractFieldTLVEncoded = () => {
    if (!this.testLength(2)) return undefined;

    // extract the tag field
    const tag = this.extract8BitUint();
    const value = this.extractFieldLVEncoded();

    // if the field is inconsistent then roll back to the initial point
    if (!value) {
      this._index--;
      return undefined;
    }
    return { tag, value };
  };

  encodeToHexaString = (value?: Uint8Array, preamble?: boolean) => {
    let result = "";
    let index = 0;

    if (!value) return result;

    if (preamble) result += "0x";

    while (index <= value.length) {
      const item = value.at(index)?.toString(16);
      if (item) result += item.length < 2 ? "0" + item : item;
      index++;
    }
    return result;
  };

  encodeToString = (value?: Uint8Array) => {
    let result = "";
    let index = 0;

    if (!value) return result;

    while (index <= value.length) {
      const item = value.at(index);
      if (item) result += String.fromCharCode(item);
      index++;
    }

    return result;
  };

  getCurrentIndex = () => {
    return this._index;
  };

  resetIndex = () => {
    this._index = 0;
  };

  getUnparsedRemainingLength = () => {
    return this._response.length - this._index;
  };

  // Private API
  private testLength = (length: number) => {
    if (this._index + length > this._response.length) return false;
    return true;
  };
}
