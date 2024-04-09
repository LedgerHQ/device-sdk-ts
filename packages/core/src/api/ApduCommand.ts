const OFFSET_CLA = 0;
const OFFSET_INS = 1;
const OFFSET_P1 = 2;
const OFFSET_P2 = 3;
export const APDU_MAX_PAYLOAD = 255;
const APDU_MAX_SIZE = APDU_MAX_PAYLOAD + 5;

type ApduCommandConstructorArgs = {
  ins: number;
  cla: number;
  p1: number;
  p2: number;
};

export class ApduCommand {
  apdu: Uint8Array = new Uint8Array(APDU_MAX_SIZE);
  offset = 5;
  constructor({ ins, cla, p1, p2 }: ApduCommandConstructorArgs) {
    this.apdu[OFFSET_CLA] = cla & 0xff;
    this.apdu[OFFSET_INS] = ins & 0xff;
    this.apdu[OFFSET_P1] = p1 & 0xff;
    this.apdu[OFFSET_P2] = p2 & 0xff;
  }

  public updateP1(value: number) {
    this.apdu[OFFSET_P1] = value & 0xff;
  }

  public updateP2(value: number) {
    this.apdu[OFFSET_P2] = value & 0xff;
  }

  public addByte(value: number | undefined): { status: boolean } {
    if (value === undefined) return { status: false };
    if (value > 0xff) return { status: false };
    if (this.offset >= APDU_MAX_SIZE) return { status: false };
    this.apdu[this.offset] = value & 0xff;
    this.offset++;
    return { status: true };
  }

  public addShort(value: number): { status: boolean } {
    if (value > 0xffff) return { status: false };

    // MSB first
    if (this.addByte((value >>> 8) & 0xff).status == false)
      return { status: false };
    return this.addByte(value & 0xff);
  }

  public addBuffer(value: Uint8Array): { status: boolean } {
    let index = 0;

    if (this.offset + value.length > APDU_MAX_SIZE) return { status: false };
    while (index < value.length) {
      // values are always being well formatted at this point
      // therefore no status test is needed
      this.addByte(value.at(index));
      index++;
    }

    return { status: true };
  }

  private addNumbers(value: number[]): { status: boolean } {
    let index = 0;

    if (this.offset + value.length > APDU_MAX_SIZE) return { status: false };
    while (index < value.length) {
      // values are always being well formatted at this point
      // therefore no status test is needed
      this.addByte(value.at(index));
      index++;
    }

    return { status: true };
  }

  public addHexaString(value: string): { status: boolean } {
    const result: number[] = this.isHexaString(value);

    if (result.length == 0) return { status: false };
    return this.addNumbers(result);
  }

  public addAsciiString(value: string): { status: boolean } {
    let index = 0;
    let hexa = 0;

    if (this.offset + value.length > APDU_MAX_SIZE) return { status: false };
    while (index < value.length) {
      // values are always being well formatted at this point
      // therefore no status test is needed
      hexa = value.charCodeAt(index);
      this.addByte(hexa).status;
      index++;
    }

    return { status: true };
  }

  private isHexaString(value: string): number[] {
    const error: number[] = [];
    const table: number[] = [];

    if (value.length === 0) return error;

    // Hexadecimal are coded on two chars
    if ((value.length & 1) != 0) return error;

    let index = 0;

    // Hexadecimal normally shoulf start with '0x'
    // but some time this preamble is missing
    if (value.startsWith("0x")) {
      index = 2;
    }

    let hexa = 0;
    const ref = /[0-9A-Fa-f]{2}/g;

    while (index < value.length) {
      const piece = value.substring(index, index + 2);
      if (ref.test(piece) == false) return error;
      ref.lastIndex = 0;
      // Attention, parseInt return an integer if the fist char is a number
      // even if the second one is a letter.
      // But the input is already tested and well formatted
      hexa = parseInt(piece, 16);
      table.push(hexa);
      index += 2;
    }

    return table;
  }

  public encodeInLVFromHexa(value: string): { status: boolean } {
    const result: number[] = this.isHexaString(value);

    if (result.length == 0) return { status: false };
    if (this.offset + result.length >= APDU_MAX_SIZE) return { status: false };
    // values are always being well formatted at this point
    // therefore no status test is needed
    this.addByte(result.length);
    return this.addNumbers(result);
  }

  public encodeInLVFromBuffer(value: Uint8Array): { status: boolean } {
    if (this.offset + value.length >= APDU_MAX_SIZE) return { status: false };
    // values are always being well formatted at this point
    // therefore no status test is needed
    this.addByte(value.length);
    return this.addBuffer(value);
  }

  public encodeInLVFromAscii(value: string): { status: boolean } {
    if (this.offset + value.length >= APDU_MAX_SIZE) return { status: false };
    // values are always being well formatted at this point
    // therefore no status test is needed
    this.addByte(value.length);
    return this.addAsciiString(value);
  }

  public clearPayload() {
    this.offset = 5;
  }

  public getAvailablePayloadLength(): number {
    return APDU_MAX_SIZE - this.offset;
  }

  public serialize(): Uint8Array {
    this.apdu[4] = this.offset - 5;
    return this.apdu.subarray(0, this.offset);
  }
}
