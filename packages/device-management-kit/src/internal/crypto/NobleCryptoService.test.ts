import { NobleCryptoService } from "./NobleCryptoService";

describe("NobleCryptoService", () => {
  let cryptoService: NobleCryptoService;

  beforeEach(() => {
    cryptoService = new NobleCryptoService();
  });

  describe("sha3_256", () => {
    it("should compute SHA3-256 hash", () => {
      const input = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const hash = cryptoService.sha3_256(input);

      expect(hash).toStrictEqual(
        new Uint8Array([
          0x96, 0x6d, 0xbd, 0xcb, 0xd0, 0xe0, 0x34, 0x8f, 0xaa, 0x1c, 0xcb,
          0xce, 0x5a, 0x62, 0xb8, 0xe7, 0x3b, 0x0d, 0x08, 0x95, 0x5d, 0x66,
          0x6d, 0xb8, 0x22, 0x43, 0xb3, 0x03, 0xd9, 0xbd, 0x95, 0x02,
        ]),
      );
    });
  });
});
