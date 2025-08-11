import { GeneralTags } from "@internal/models/Tags";

export class TLVBuilder {
  private items: Uint8Array[] = [];

  addNull() {
    return this.add(GeneralTags.Null, []);
  }

  addInt(value: number, length: 1 | 2 | 4) {
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
    return this.add(GeneralTags.Int, new Uint8Array(view.buffer));
  }

  addHash(value: Uint8Array) {
    return this.add(GeneralTags.Hash, value);
  }

  addSignature(value: Uint8Array) {
    return this.add(GeneralTags.Signature, value);
  }

  addString(value: string) {
    return this.add(GeneralTags.String, new TextEncoder().encode(value));
  }

  addBytes(value: Uint8Array | number[]) {
    return this.add(GeneralTags.Bytes, value);
  }

  addPublicKey(value: Uint8Array) {
    return this.add(GeneralTags.PublicKey, value);
  }

  build(): Uint8Array {
    return new Uint8Array(this.items.flatMap((item) => [...item]));
  }

  with(fn: (builder: TLVBuilder) => void): TLVBuilder {
    fn(this);
    return this;
  }

  push(item: Uint8Array) {
    this.items.push(item);
    return this;
  }

  private add(type: number, value: Uint8Array | number[]) {
    this.items.push(new Uint8Array([type, value.length, ...value]));
    return this;
  }
}
