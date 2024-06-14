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
        acc + val * Math.pow(0x100, array.length - 1 - index),
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
      return (number >> (8 * (size - 1 - index))) & 0xff;
    });
  },
};
