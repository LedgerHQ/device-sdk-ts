export type ApduResponseConstructorArgs = {
  statusCode: Uint8Array;
  data: Uint8Array;
};

export class ApduResponse {
  public statusCode: Uint8Array;
  public data: Uint8Array;

  constructor({ statusCode, data }: ApduResponseConstructorArgs) {
    this.statusCode = statusCode;
    this.data = data;
  }
}
