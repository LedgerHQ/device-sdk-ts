import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetPubKeyCommand } from "./GetPubKeyCommand";

const GET_PUBKYEY_APDU_DEFAULT_PATH_WITH_CONFIRM = new Uint8Array([
  0xe0, 0x05, 0x01, 0x00, 0x09, 0x02, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x01,
  0xf5,
]);

const GET_PUBKYEY_APDU_DEFAULT_PATH_WITHOUT_CONFIRM = new Uint8Array([
  0xe0, 0x05, 0x00, 0x00, 0x09, 0x02, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x01,
  0xf5,
]);

const GET_PUBKEY_APDU_DIFFERENT_PATH = new Uint8Array([
  0xe0, 0x05, 0x01, 0x00, 0x09, 0x02, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x01,
  0xf6,
]);

// D2PPQSYFe83nDzk96FqGumVU8JA7J8vj2Rhjc2oXzEi5
const GET_PUBKEY_APDU = new Uint8Array([
  0xb2, 0xa7, 0x22, 0xdc, 0x18, 0xdd, 0x5c, 0x49, 0xc3, 0xf4, 0x8e, 0x9b, 0x07,
  0x26, 0xf1, 0x1b, 0xe6, 0x67, 0x86, 0xe9, 0x1c, 0xac, 0x57, 0x34, 0x98, 0xd6,
  0xee, 0x88, 0x39, 0x2c, 0xc9, 0x6a, 0x90, 0x00,
]);

const GET_PUBKEY_APDU_RESPONSE = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: GET_PUBKEY_APDU,
});

describe("GetPubKeyCommand", () => {
  let command: GetPubKeyCommand;
  const defaultArgs = {
    derivationPath: "44'/501'",
    checkOnDevice: true,
  };

  beforeEach(() => {
    command = new GetPubKeyCommand(defaultArgs);
    jest.clearAllMocks();
    jest.requireActual("@ledgerhq/device-management-kit");
  });

  describe("getApdu", () => {
    it("should return APDU", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toEqual(
        GET_PUBKYEY_APDU_DEFAULT_PATH_WITH_CONFIRM,
      );
    });

    it("should return APDU without confirm", () => {
      command = new GetPubKeyCommand({
        ...defaultArgs,
        checkOnDevice: false,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toEqual(
        GET_PUBKYEY_APDU_DEFAULT_PATH_WITHOUT_CONFIRM,
      );
    });

    it("should return APDU with different path", () => {
      command = new GetPubKeyCommand({
        ...defaultArgs,
        derivationPath: "44'/502'",
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toEqual(GET_PUBKEY_APDU_DIFFERENT_PATH);
    });
  });

  describe("parseResponse", () => {
    it("should parse the response", () => {
      const parsed = command.parseResponse(GET_PUBKEY_APDU_RESPONSE);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: "D2PPQSYFe83nDzk96FqGumVU8JA7J8vj2Rhjc2oXzEi5",
        }),
      );
    });

    describe("error handling", () => {
      it("should return error if response is not success", () => {
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x6a, 0x82]),
          data: new Uint8Array(0),
        });
        const result = command.parseResponse(response);
        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toEqual(
            expect.objectContaining({
              _tag: "InvalidStatusWordError",
              originalError: expect.objectContaining({
                message: "Public key is missing",
              }),
            }),
          );
        } else {
          fail("Expected error");
        }
      });

      it("should return error if public key is missing", () => {
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: new Uint8Array(0),
        });
        const result = command.parseResponse(response);
        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error.originalError).toEqual(
            expect.objectContaining({
              message: "Public key is missing",
            }),
          );
        } else {
          fail("Expected error");
        }
      });
    });
  });
});
