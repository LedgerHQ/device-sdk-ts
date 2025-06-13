import { GeneralPurposeTypes } from "./TLVTypes";

export class TLVBuilder {
  private items: Uint8Array[] = [];

  addNull() {
    return this.add(GeneralPurposeTypes.NULL, []);
  }

  addVarInt(value: number, length: 1 | 2 | 4) {
    const view = new DataView(new ArrayBuffer(length));
    switch (length) {
      case 1:
        view.setUint8(0, value);
        break;
      case 2:
        view.setUint16(0, value);
        break;
      case 4:
        view.setUint32(0, value);
        break;
    }
    return this.add(GeneralPurposeTypes.VARINT, new Uint8Array(view.buffer));
  }

  addString(value: string) {
    return this.add(
      GeneralPurposeTypes.STRING,
      new TextEncoder().encode(value),
    );
  }

  addBytes(value: Uint8Array | number[]) {
    return this.add(GeneralPurposeTypes.BYTES, value);
  }

  addPublicKey(value: Uint8Array) {
    return this.add(GeneralPurposeTypes.PUBKEY, value);
  }

  build(): Uint8Array {
    return new Uint8Array(this.items.flatMap((item) => [...item]));
  }

  with(fn: (builder: TLVBuilder) => TLVBuilder) {
    return fn(this);
  }

  private add(type: number, value: Uint8Array | number[]) {
    this.items.push(new Uint8Array([type, value.length, ...value]));
    return this;
  }
}
