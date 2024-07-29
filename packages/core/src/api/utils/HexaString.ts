export type HexaString = `0x${string}`;

export const isHexaString = (value: string): value is HexaString => {
  return /^0x[0-9a-fA-F]*$/.test(value);
};
