export const isValidHex = (value: string): boolean =>
  /^[0-9a-fA-F]*$/.test(value) && value.length % 2 === 0;
