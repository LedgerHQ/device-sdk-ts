const BYTE_BASE = 0x100;
const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xff;

export const FramerUtils = {
  /*
   * Get last bytes of Uint8Array
   *
   * @param Uint8Array
   */
  getLastBytesFrom(array: Uint8Array, size: number): Uint8Array {
    return array.slice(-size);
  },

  /*
   * Get first bytes of Uint8Array
   *
   * @param Uint8Array
   */
  getFirstBytesFrom(array: Uint8Array, size: number): Uint8Array {
    return array.slice(0, size);
  },

  /*
   * Get number from Uint8Array
   *
   * @param Uint8Array
   */
  bytesToNumber(array: Uint8Array): number {
    return array.reduce(
      (acc, val, index) =>
        acc + val * Math.pow(BYTE_BASE, array.length - 1 - index),
      0,
    );
  },

  /*
   *  Get bytes Uint8Array from number
   *
   * @param number
   * @param size
   */
  numberToByteArray(number: number, size: number): Uint8Array {
    return new Uint8Array(size).map((_el, index) => {
      return (number >> (BITS_PER_BYTE * (size - 1 - index))) & BYTE_MASK;
    });
  },
};
