import { Key } from "./Key";

describe("Key", () => {
  describe("toHexaString", () => {
    it("Empty key", () => {
      const key = new Key(12);
      expect(key.toHexaString()).toStrictEqual("0c");
    });

    it("Key with data", () => {
      const key = new Key(12, Uint8Array.from([0, 1, 2, 3, 4, 5]));
      expect(key.toHexaString()).toStrictEqual("0c000102030405");
    });
  });
});
