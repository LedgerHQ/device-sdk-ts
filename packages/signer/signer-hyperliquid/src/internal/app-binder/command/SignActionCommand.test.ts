import {
  SignActionCommand,
  type SignActionsCommandArgs,
} from "./SignActionCommand";

describe("SignActionCommand", () => {
  const defaultArgs: SignActionsCommandArgs = {
    derivationPath: "44'/60'/0'/0/0",
    Actions: new Uint8Array(),
  };

  describe("name", () => {
    it("should be 'SignAction'", () => {
      const command = new SignActionCommand(defaultArgs);
      expect(command.name).toBe("SignAction");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU with derivation path in data", () => {
      // GIVEN
      const command = new SignActionCommand(defaultArgs);

      // WHEN
      const apdu = command.getApdu();

      // THEN
      const expectedData = new TextEncoder().encode(defaultArgs.derivationPath);
      expect(apdu.data).toStrictEqual(expectedData);
      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x03);
      expect(apdu.p1).toBe(0x00);
      expect(apdu.p2).toBe(0x00);
    });

    it("should return the correct APDU when derivation path is custom", () => {
      // GIVEN
      const derivationPath = "44'/60'/0'/0/1";
      const command = new SignActionCommand({
        ...defaultArgs,
        derivationPath,
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      const expectedData = new TextEncoder().encode(derivationPath);
      expect(apdu.data).toStrictEqual(expectedData);
      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x03);
      expect(apdu.p1).toBe(0x00);
      expect(apdu.p2).toBe(0x00);
    });
  });
});
