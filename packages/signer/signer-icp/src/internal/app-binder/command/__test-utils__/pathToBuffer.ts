import { DerivationPathUtils } from "@ledgerhq/signer-utils";

// Independent oracle kept separate from the production encoder, so command
// tests assert the APDU path against a hand-rolled reference, not the code under test.
export const pathToBuffer = (derivationPath: string): Uint8Array => {
  const parts = DerivationPathUtils.splitPath(derivationPath);
  const view = new DataView(new ArrayBuffer(20));
  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i]! & 0x7fffffff;
    const hardened = i < 3 ? (0x80000000 | raw) >>> 0 : raw >>> 0;
    view.setUint32(i * 4, hardened, true);
  }
  return new Uint8Array(view.buffer);
};
