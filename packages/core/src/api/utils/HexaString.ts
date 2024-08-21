export type HexaString = `0x${string}`;

export const isHexaString = (value: string): value is HexaString => {
  return /^0x[0-9a-fA-F]*$/.test(value);
};

export const hexaStringToBuffer = (value: string): Uint8Array | null => {
  if (value.startsWith("0x")) {
    value = value.slice(2);
  }
  if (value.length === 0) {
    return new Uint8Array();
  }
  if (value.length % 2 !== 0) {
    value = "0" + value;
  }
  if (/^[0-9a-fA-F]*$/.test(value) === false) {
    return null;
  }
  const bytes = value.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16));
  if (!bytes || bytes.some(isNaN)) {
    return null;
  }
  return new Uint8Array(bytes);
};
