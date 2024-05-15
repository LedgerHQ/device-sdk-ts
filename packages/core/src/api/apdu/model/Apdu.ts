/**
 * Represents an APDU command that can be sent to a device.
 * DO NOT USE THIS CLASS DIRECTLY, use ApduBuilder instead.
 */
export class Apdu {
  /**
   * Instruction class (1 byte)
   */
  readonly cla: number;

  /**
   * Instruction code (1 byte)
   */
  readonly ins: number;

  /**
   * Instruction parameter 1 (2 bytes)
   */
  readonly p1: number;

  /**
   * Instruction parameter 2 (2 bytes)
   */
  readonly p2: number;

  /**
   * Bytes of data
   */
  data?: Uint8Array;

  constructor(
    cla: number,
    ins: number,
    p1: number,
    p2: number,
    data?: Uint8Array,
  ) {
    this.cla = cla;
    this.ins = ins;
    this.p1 = p1;
    this.p2 = p2;
    this.data = data;
  }

  /**
   * Get the raw binary data of the APDU command
   * @returns {Uint8Array} - The raw APDU command
   */
  getRawApdu(): Uint8Array {
    const header = Uint8Array.from([
      this.cla,
      this.ins,
      this.p1,
      this.p2,
      this.data?.length ?? 0,
    ]);

    const apdu = new Uint8Array(header.length + (this.data?.length ?? 0));
    apdu.set(header, 0);

    if (this.data) {
      apdu.set(this.data, header.length);
    }

    return apdu;
  }
}
