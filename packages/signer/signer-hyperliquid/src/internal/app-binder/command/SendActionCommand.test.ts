import {
  SendActionCommand,
  type SendActionCommandArgs,
} from "./SendActionCommand";

describe("SendActionCommand", () => {
  const serializedAction = new Uint8Array([
    0x01, 0x01, 0x2c, 0x02, 0x01, 0x01, 0xd0, 0x01, 0x00, 0xda, 0x08, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2a, 0xdb, 0x03, 0xdd, 0x01, 0x00,
  ]);

  const defaultArgs: SendActionCommandArgs = {
    serializedAction,
  };

  describe("name", () => {
    it("should be 'SendAction'", () => {
      const command = new SendActionCommand(defaultArgs);
      expect(command.name).toBe("SendAction");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU with cla 0x0E and ins 0x03 per specs", () => {
      const command = new SendActionCommand(defaultArgs);

      const apdu = command.getApdu();

      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x03);
      expect(apdu.p1).toBe(0x01);
      expect(apdu.p2).toBe(0x00);
      expect(apdu.data).toStrictEqual(
        new Uint8Array([0x00, 0x18, ...serializedAction]),
      );
    });

    it("should use serializedAction as APDU data", () => {
      const customTlv = new Uint8Array([0x01, 0x02, 0x03]);
      const command = new SendActionCommand({
        serializedAction: customTlv,
      });

      const apdu = command.getApdu();

      expect(apdu.data).toStrictEqual(
        new Uint8Array([0x00, 0x03, ...customTlv]),
      );
    });
  });
});
