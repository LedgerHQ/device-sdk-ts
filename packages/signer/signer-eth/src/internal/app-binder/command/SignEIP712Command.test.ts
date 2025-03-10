import {
  type Command,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { type EthErrorCodes } from "./utils/ethAppErrors";
import {
  SignEIP712Command,
  type SignEIP712CommandResponse,
} from "./SignEIP712Command";

const SIGN_EIP712_APDU = Uint8Array.from([
  0xe0, 0x0c, 0x00, 0x01, 0x15, 0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00,
  0x3c, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const SIGN_EIP712_APDU_V0 = Uint8Array.from([
  0xe0, 0x0c, 0x00, 0x00, 0x55, 0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00,
  0x3c, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11,
  0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11,
  0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22,
  0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22,
  0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22,
]);

const LNX_RESPONSE_DATA_GOOD = Uint8Array.from([
  0x1c, 0x8a, 0x54, 0x05, 0x10, 0xe1, 0x3b, 0x0f, 0x2b, 0x11, 0xa4, 0x51, 0x27,
  0x57, 0x16, 0xd2, 0x9e, 0x08, 0xca, 0xad, 0x07, 0xe8, 0x9a, 0x1c, 0x84, 0x96,
  0x47, 0x82, 0xfb, 0x5e, 0x1a, 0xd7, 0x88, 0x64, 0xa0, 0xde, 0x23, 0x5b, 0x27,
  0x0f, 0xbe, 0x81, 0xe8, 0xe4, 0x06, 0x88, 0xf4, 0xa9, 0xf9, 0xad, 0x9d, 0x28,
  0x3d, 0x69, 0x05, 0x52, 0xc9, 0x33, 0x1d, 0x77, 0x73, 0xce, 0xaf, 0xa5, 0x13,
]);

const LNX_RESPONSE_GOOD = {
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: LNX_RESPONSE_DATA_GOOD,
};

const LNX_RESPONSE_LOCKED = {
  statusCode: Uint8Array.from([0x55, 0x15]),
  data: new Uint8Array(),
};

const LNX_RESPONSE_DATA_TOO_SHORT = Uint8Array.from([0x01, 0x02]);

const LNX_RESPONSE_TOO_SHORT = {
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: LNX_RESPONSE_DATA_TOO_SHORT,
};

describe("SignEIP712Command", () => {
  let command: Command<SignEIP712CommandResponse, void, EthErrorCodes>;

  beforeEach(() => {
    command = new SignEIP712Command({
      derivationPath: "44'/60'/0'/0/0",
      legacyArgs: Nothing,
    });
  });

  describe("getApdu", () => {
    it("should provide the derivation path", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(SIGN_EIP712_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should parse the response", () => {
      const parsedResponse = command.parseResponse(LNX_RESPONSE_GOOD);
      expect(parsedResponse).toStrictEqual(
        CommandResultFactory({
          data: {
            v: 0x1c,
            r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
            s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
          },
        }),
      );
    });

    it("should return an error if the response is not successful", () => {
      const response = command.parseResponse(LNX_RESPONSE_LOCKED);
      expect(isSuccessCommandResult(response)).toBe(false);
    });

    it("should return an error if the response is too short", () => {
      const response = command.parseResponse(LNX_RESPONSE_TOO_SHORT);
      expect(isSuccessCommandResult(response)).toBe(false);
    });
  });
});

describe("SignEIP712Command V0", () => {
  describe("getApdu", () => {
    it("should provide the derivation path and hashes", () => {
      const command = new SignEIP712Command({
        derivationPath: "44'/60'/0'/0/0",
        legacyArgs: Just({
          domainHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          messageHash:
            "0x2222222222222222222222222222222222222222222222222222222222222222",
        }),
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(SIGN_EIP712_APDU_V0);
    });
  });
});
