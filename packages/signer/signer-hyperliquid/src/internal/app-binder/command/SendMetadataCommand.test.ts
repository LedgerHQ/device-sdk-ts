import {
  CommandResultFactory,
  hexaStringToBuffer,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  SendMetadataCommand,
  type SendMetadataCommandArgs,
} from "./SendMetadataCommand";

describe("SendMetadataCommand", () => {
  const defaultArgs: SendMetadataCommandArgs = {
    // signedMetadata: new Uint8Array([0x01, 0x02, 0x03]),
    signedMetadata: hexaStringToBuffer(
      "01012b02010181d0010081d10400000001240345544881d20100154730450220346b19f3cdae6aea7eb88c1afe416274f635dd494cf5a8add57856d2429a9f7d022100f4202dc04ed2ca3ab65b6518aa7dae1899191278cc7f97e28a2fd0a1aaf18d45",
    )!,
  };
  let command: SendMetadataCommand;

  beforeEach(() => {
    command = new SendMetadataCommand(defaultArgs);
  });

  describe("name", () => {
    it("should be 'sendMetadata'", () => {
      expect(command.name).toBe("sendMetadata");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU with actionsCount in data", () => {
      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.data).toStrictEqual(
        new Uint8Array([0x00, 0x63, ...defaultArgs.signedMetadata]),
      );
      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x02);
      expect(apdu.p1).toBe(0x01);
      expect(apdu.p2).toBe(0x00);
      expect(apdu.getRawApdu()).toStrictEqual(
        hexaStringToBuffer(
          "e002010065006301012b02010181d0010081d10400000001240345544881d20100154730450220346b19f3cdae6aea7eb88c1afe416274f635dd494cf5a8add57856d2429a9f7d022100f4202dc04ed2ca3ab65b6518aa7dae1899191278cc7f97e28a2fd0a1aaf18d45",
        )!,
      );
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
