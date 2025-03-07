import { base64ToUint8Array, uint8ArrayToBase64 } from "./base64Utils";

const someBase64 = "AQIDkAA=";
const someUint8Array = new Uint8Array([0x01, 0x02, 0x03, 0x90, 0x00]);

describe("base64Utils", () => {
  describe("uint8ArrayToBase64", () => {
    it("converts a Uint8Array to a Base64-encoded string", () => {
      const base64 = uint8ArrayToBase64(someUint8Array);
      expect(base64).toBe(someBase64);
    });
  });

  describe("base64ToUint8Array", () => {
    it("converts a Base64-encoded string to a Uint8Array", () => {
      const byteArray = base64ToUint8Array(someBase64);
      expect(byteArray).toEqual(someUint8Array);
    });
  });
});
