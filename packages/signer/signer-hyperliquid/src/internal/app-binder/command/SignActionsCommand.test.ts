import {
  CommandResultFactory,
  hexaStringToBuffer,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignActionsCommand } from "./SignActionsCommand";

describe("SignActionsCommand", () => {
  let command: SignActionsCommand;

  beforeEach(() => {
    command = new SignActionsCommand({ derivationPath: "44'/637'/0'/0'" });
  });

  describe("name", () => {
    it("should be 'SignActions'", () => {
      expect(command.name).toBe("SignActions");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU", () => {
      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x04);
      expect(apdu.p1).toBe(0x00);
      expect(apdu.p2).toBe(0x00);
      expect(apdu.data.length).toBe(0x11);
    });
  });

  describe("parseResponse", () => {
    it("should parse the response", () => {
      const LNX_RESPONSE_GOOD = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: hexaStringToBuffer(
          "021c1a7718eede70393bbc640a649ee65401748953a1b671ffa15fea9cb7e209289837e2621d96135f05f54fe891bb5850a94003717dfe228c270fba5d8e7f35b590",
        )!,
      };

      const parsedResponse = command.parseResponse(LNX_RESPONSE_GOOD);
      expect(parsedResponse).toStrictEqual(
        CommandResultFactory({
          data: {
            signaturesLeft: 2,
            signature: {
              r: "1a7718eede70393bbc640a649ee65401748953a1b671ffa15fea9cb7e2092898",
              s: "37e2621d96135f05f54fe891bb5850a94003717dfe228c270fba5d8e7f35b590",
              v: 0x1c,
            },
          },
        }),
      );
    });

    it("should return an error if the status code is not 0x9000", () => {
      const LNX_RESPONSE_ERROR = {
        statusCode: Uint8Array.from([0x6a, 0x80]),
        data: new Uint8Array(),
      };

      const result = command.parseResponse(LNX_RESPONSE_ERROR);
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return an error if response contains unexpected data", () => {
      const LNX_RESPONSE_EXTRA = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([0x01]),
      };

      const result = command.parseResponse(LNX_RESPONSE_EXTRA);
      expect(isSuccessCommandResult(result)).toBe(false);
      // @ts-expect-error response is not typed
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    });
  });
});
