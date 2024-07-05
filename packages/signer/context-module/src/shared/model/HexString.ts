export type HexString = `0x${string}`;

export const isHexString = (value: string): value is HexString => {
  return /^0x[0-9a-fA-F]*$/.test(value);
};
