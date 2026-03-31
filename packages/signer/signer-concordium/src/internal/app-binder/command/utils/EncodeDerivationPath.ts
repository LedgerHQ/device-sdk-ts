import { DerivationPathUtils } from "@ledgerhq/signer-utils";

const UNHARDENED_MASK = 0x7fffffff;
const HARDENED_BIT = 0x80000000;
const BYTES_PER_ELEMENT = 4;

/**
 * Encode a Concordium derivation path string as a Uint8Array.
 *
 * Concordium BIP44 path: 44'/919'/account'/identity'/credential'
 * (without "m/" prefix — DerivationPathUtils.splitPath does not accept it)
 *
 * All elements are hardened in the output regardless of input.
 *
 * Output format matches firmware expectation:
 * [path_length: 1 byte][element_0: 4 bytes BE]...[element_n: 4 bytes BE]
 */
export const encodeDerivationPath = (derivationPath: string): Uint8Array => {
  const paths = DerivationPathUtils.splitPath(derivationPath);
  const buf = new DataView(
    new ArrayBuffer(1 + paths.length * BYTES_PER_ELEMENT),
  );
  buf.setUint8(0, paths.length);
  for (let i = 0; i < paths.length; i++) {
    const raw = paths[i]! & UNHARDENED_MASK;
    const hardened = (HARDENED_BIT | raw) >>> 0;
    buf.setUint32(1 + i * 4, hardened, false);
  }
  return new Uint8Array(buf.buffer);
};
