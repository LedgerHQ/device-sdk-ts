import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  GetPubKeyCommand,
  type GetPubKeyCommandArgs,
} from "@internal/app-binder/command/GetPubKeyCommand";

const GET_PUBKYEY_APDU_WITH_CHECK_ON_DEVICE = new Uint8Array([
  0x55, 0x04, 0x01, 0x00, 0x1b, 0x06, 0x63, 0x6f, 0x73, 0x6d, 0x6f, 0x73, 0x2c,
  0x00, 0x00, 0x80, 0x76, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const GET_PUBKYEY_APDU_WITHOUT_CHECK_ON_DEVICE = new Uint8Array([
  0x55, 0x04, 0x00, 0x00, 0x1b, 0x06, 0x63, 0x6f, 0x73, 0x6d, 0x6f, 0x73, 0x2c,
  0x00, 0x00, 0x80, 0x76, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const GET_PUBKEY_APDU_DIFFERENT_PATH = new Uint8Array([
  0x55, 0x04, 0x00, 0x00, 0x1b, 0x06, 0x63, 0x6f, 0x73, 0x6d, 0x6f, 0x73, 0x2c,
  0x00, 0x00, 0x80, 0x77, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const GET_PUBKEY_APDU_RESPONSE_GOOD = new Uint8Array([
  0x03, 0x01, 0xe5, 0xe8, 0x53, 0x50, 0x82, 0x3c, 0x80, 0x98, 0xc4, 0xbf, 0xb4,
  0xb6, 0xa0, 0xef, 0x53, 0x79, 0x79, 0x93, 0x43, 0xd8, 0xae, 0x56, 0x74, 0x6f,
  0x73, 0x63, 0x8b, 0xc9, 0x84, 0xc2, 0x40, 0x63, 0x6f, 0x73, 0x6d, 0x6f, 0x73,
  0x31, 0x70, 0x74, 0x36, 0x68, 0x34, 0x63, 0x63, 0x35, 0x72, 0x71, 0x37, 0x36,
  0x73, 0x79, 0x78, 0x73, 0x70, 0x34, 0x33, 0x7a, 0x7a, 0x65, 0x37, 0x6a, 0x78,
  0x67, 0x32, 0x33, 0x38, 0x77, 0x77, 0x37, 0x6e, 0x34, 0x65, 0x63, 0x77, 0x63,
]);

const GET_PUBKEY_APDU_RESPONSE = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: GET_PUBKEY_APDU_RESPONSE_GOOD,
});

describe("GetPubKeyCommand", () => {
  let command: GetPubKeyCommand;
  const defaultDerivationPath = "44'/118'/0'/0/0";
  const defaultPrefix = "cosmos";

  const defaultArgs: GetPubKeyCommandArgs = {
    derivationPath: defaultDerivationPath,
    checkOnDevice: true,
    prefix: defaultPrefix,
  };
  const goodResponse = {
    address: "cosmos1pt6h4cc5rq76syxsp43zze7jxg238ww7n4ecwc",
    publicKey: new Uint8Array([
      0x03, 0x01, 0xe5, 0xe8, 0x53, 0x50, 0x82, 0x3c, 0x80, 0x98, 0xc4, 0xbf,
      0xb4, 0xb6, 0xa0, 0xef, 0x53, 0x79, 0x79, 0x93, 0x43, 0xd8, 0xae, 0x56,
      0x74, 0x6f, 0x73, 0x63, 0x8b, 0xc9, 0x84, 0xc2, 0x40,
    ]),
  };

  beforeEach(() => {
    command = new GetPubKeyCommand(defaultArgs);
    vi.clearAllMocks();
    vi.importActual("@ledgerhq/device-management-kit");
  });

  describe("name", () => {
    it("should be 'getPubKey'", () => {
      expect(command.name).toBe("getPubKey");
    });
  });

  describe("getApdu", () => {
    it("should return APDU", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toEqual(GET_PUBKYEY_APDU_WITH_CHECK_ON_DEVICE);
    });

    it("should return APDU without confirm", () => {
      command = new GetPubKeyCommand({
        ...defaultArgs,
        checkOnDevice: false,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toEqual(
        GET_PUBKYEY_APDU_WITHOUT_CHECK_ON_DEVICE,
      );
    });

    it("should return APDU with different path", () => {
      command = new GetPubKeyCommand({
        ...defaultArgs,
        checkOnDevice: false,
        derivationPath: "44'/119'/0'/0/0",
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toEqual(GET_PUBKEY_APDU_DIFFERENT_PATH);
    });

    it("should throw an error with invalid HdPath", () => {
      command = new GetPubKeyCommand({
        ...defaultArgs,
        checkOnDevice: false,
        derivationPath: "44'/119'",
      });
      expect(() => command.getApdu()).toThrowErrorMatchingInlineSnapshot(
        "[Error: GetPubKeyCommand: expected cosmos derivation path with 5 elements, got 2]",
      );
    });
  });

  describe("parseResponse", () => {
    it("should parse the response", () => {
      const parsed = command.parseResponse(GET_PUBKEY_APDU_RESPONSE);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: goodResponse,
        }),
      );
    });

    describe("error handling", () => {
      it("should return error if error occured during execution", () => {
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x64, 0x00]),
          data: new Uint8Array(0),
        });
        const result = command.parseResponse(response);
        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toEqual(
            expect.objectContaining({
              _tag: "CosmosAppCommandError",
              errorCode: "6400",
              message: "Execution Error",
            }),
          );
        } else {
          assert.fail("Expected error");
        }
      });

      it("should return error if public key is missing", () => {
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x69, 0x82]),
          data: new Uint8Array(0),
        });
        const result = command.parseResponse(response);
        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toEqual(
            expect.objectContaining({
              _tag: "CosmosAppCommandError",
              errorCode: "6982",
              message: "Empty buffer",
            }),
          );
        } else {
          assert.fail("Expected error");
        }
      });

      it("should return error when payload length is lower than minimum", () => {
        const parsed = command.parseResponse(
          new ApduResponse({
            statusCode: Uint8Array.from([0x90, 0x00]),
            data: GET_PUBKEY_APDU_RESPONSE_GOOD.slice(0, 30), // 30bytes
          }),
        );
        expect(isSuccessCommandResult(parsed)).toBe(false);
        if (!isSuccessCommandResult(parsed)) {
          expect(parsed.error.originalError).toEqual(
            expect.objectContaining({
              message: "Public key is missing",
            }),
          );
        } else {
          assert.fail("Expected error");
        }
      });

      it("should return error when payload does not contain address", () => {
        const parsed = command.parseResponse(
          new ApduResponse({
            statusCode: Uint8Array.from([0x90, 0x00]),
            data: GET_PUBKEY_APDU_RESPONSE_GOOD.slice(0, 33), // 33bytes
          }),
        );
        expect(isSuccessCommandResult(parsed)).toBe(false);
        if (!isSuccessCommandResult(parsed)) {
          expect(parsed.error.originalError).toEqual(
            expect.objectContaining({
              message: "Address is missing",
            }),
          );
        } else {
          assert.fail("Expected error");
        }
      });
    });
  });
});
