export type ApduResponseConstructorArgs = {
  readonly statusCode: Uint8Array;
  readonly data: Uint8Array;
};

export class ApduResponse {
  public readonly statusCode: Uint8Array;
  public readonly data: Uint8Array;

  constructor({ statusCode, data }: ApduResponseConstructorArgs) {
    this.statusCode = statusCode;
    this.data = data;
  }
}
