// ICP paths are fixed at 5 levels (m/44'/223'/account'/change/index); the
// first three are hardened. Values are little-endian uint32.
const DERIVATION_PATH_LENGTH = 5;
const HARDENED_LEVELS = 3;
const HARDENED_OFFSET = 0x80000000;

export const encodeDerivationPath = (paths: number[]): Uint8Array => {
  if (paths.length !== DERIVATION_PATH_LENGTH) {
    throw new Error(
      `encodeDerivationPath: expected ${DERIVATION_PATH_LENGTH} path elements, got ${paths.length}`,
    );
  }
  const dataView = new DataView(new ArrayBuffer(DERIVATION_PATH_LENGTH * 4));
  for (let i = 0; i < paths.length; i++) {
    const raw = paths[i]! & 0x7fffffff;
    const hardened =
      i < HARDENED_LEVELS ? (HARDENED_OFFSET | raw) >>> 0 : raw >>> 0;
    dataView.setUint32(i * 4, hardened, true);
  }
  return new Uint8Array(dataView.buffer);
};
