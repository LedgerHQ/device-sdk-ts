import { PayloadUtils } from "./PayloadUtils";

describe("PayloadUtils", () => {
  describe("getBufferFromPayload", () => {
    it("should return null if the payload is empty", () => {
      // GIVEN
      const payload = "";
      // WHEN
      const buffer = PayloadUtils.getBufferFromPayload(payload);
      // THEN
      expect(buffer).toBeNull();
    });

    it("should return null if the payload is invalid", () => {
      // GIVEN
      const payload = "invalid";
      // WHEN
      const buffer = PayloadUtils.getBufferFromPayload(payload);
      // THEN
      expect(buffer).toBeNull();
    });

    it("should return the buffer from the payload", () => {
      // GIVEN
      const payload = "010203";
      // WHEN
      const buffer = PayloadUtils.getBufferFromPayload(payload);
      // THEN
      expect(buffer).toStrictEqual(
        Uint8Array.from([0x00, 0x03, 0x01, 0x02, 0x03]),
      );
    });

    it("should return the buffer from the payload without payload length", () => {
      // GIVEN
      const payload = "010203";
      // WHEN
      const buffer = PayloadUtils.getBufferFromPayload(payload, false);
      // THEN
      expect(buffer).toStrictEqual(Uint8Array.from([0x01, 0x02, 0x03]));
    });
  });
});
