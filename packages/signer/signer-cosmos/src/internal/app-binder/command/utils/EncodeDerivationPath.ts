export const encodeDerivationPath = (paths: number[]): Uint8Array => {
  const dataView = new DataView(new ArrayBuffer(20));
  for (let i = 0; i < paths.length; i++) {
    const raw = paths[i]! & 0x7fffffff;
    const hardened = i < 3 ? (0x80000000 | raw) >>> 0 : raw >>> 0;
    dataView.setUint32(i * 4, hardened, true);
  }
  return new Uint8Array(dataView.buffer);
};
