const DERIVATION_PATH_BUFFER_SIZE = 20;
const UNHARDENED_MASK = 0x7fffffff;
const HARDENED_PATH_COUNT = 3;
const HARDENED_BIT = 0x80000000;
const BYTES_PER_ELEMENT = 4;

export const encodeDerivationPath = (paths: number[]): Uint8Array => {
  const dataView = new DataView(new ArrayBuffer(DERIVATION_PATH_BUFFER_SIZE));
  for (let i = 0; i < paths.length; i++) {
    const raw = paths[i]! & UNHARDENED_MASK;
    const hardened =
      i < HARDENED_PATH_COUNT ? (HARDENED_BIT | raw) >>> 0 : raw >>> 0;
    dataView.setUint32(i * BYTES_PER_ELEMENT, hardened, true);
  }
  return new Uint8Array(dataView.buffer);
};
