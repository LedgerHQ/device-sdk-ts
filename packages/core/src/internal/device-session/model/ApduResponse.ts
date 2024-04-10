export type ApduResponseConstructorArgs = {
  statusCode: Uint8Array;
  data: Uint8Array;
};

export class ApduResponse {
  protected _statusCode: Uint8Array;
  protected _data: Uint8Array;

  constructor({ statusCode, data }: ApduResponseConstructorArgs) {
    this._statusCode = statusCode;
    this._data = data;
  }
}
