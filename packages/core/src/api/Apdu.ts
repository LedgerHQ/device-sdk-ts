export class Apdu {
  readonly cla: number;
  readonly ins: number;
  readonly p1: number;
  readonly p2: number;
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
