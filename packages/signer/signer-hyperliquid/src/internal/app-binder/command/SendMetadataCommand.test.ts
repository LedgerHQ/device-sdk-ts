import {
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  SendMetadataCommand,
  type SendMetadataCommandArgs,
} from "./SendMetadataCommand";

describe("SendMetadataCommand", () => {
  const defaultArgs: SendMetadataCommandArgs = {
    signedMetadata: new Uint8Array([0x01, 0x02, 0x03]),
  };
  let command: SendMetadataCommand;

  beforeEach(() => {
    command = new SendMetadataCommand(defaultArgs);
  });

  describe("name", () => {
    it("should be 'SendMetadata'", () => {
      expect(command.name).toBe("SendMetadata");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU with actionsCount in data", () => {
      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.data).toStrictEqual(defaultArgs.signedMetadata);
      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x02);
      expect(apdu.p1).toBe(0x00);
      expect(apdu.p2).toBe(0x00);
    });
  });

  describe("parseResponse", () => {
    it("should return success when status is 0x9000 and no data", () => {
      const LNX_RESPONSE_GOOD = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      };

      const parsed = command.parseResponse(LNX_RESPONSE_GOOD);
      expect(parsed).toStrictEqual(CommandResultFactory({ data: undefined }));
      expect(isSuccessCommandResult(parsed)).toBe(true);
    });
  });
});
