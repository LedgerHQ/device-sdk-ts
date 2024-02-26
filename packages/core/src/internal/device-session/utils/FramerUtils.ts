export const FramerUtils = {
  /*
   * Get last bytes of Uint8Array
   *
   * @param Uint8Array
   */
  getLastBytesFrom(array: Uint8Array, size: number): Uint8Array {
    return new Uint8Array(array.slice(-size));
  },
};
