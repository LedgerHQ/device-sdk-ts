import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SW_INTERRUPTED_EXECUTION } from "./utils/constants";
import {
  GetWalletAddressCommand,
  type GetWalletAddressCommandArgs,
} from "./GetWalletAddressCommand";

const SUCCESS_STATUS = new Uint8Array([0x90, 0x00]);
const USER_DENIED_STATUS = new Uint8Array([0x69, 0x85]);

describe("GetWalletAddressCommand", () => {
  let command: GetWalletAddressCommand;
  const defaultArgs: GetWalletAddressCommandArgs = {
    checkOnDevice: true,
    walletId: Uint8Array.from("walletIdBuffer", (c) => c.charCodeAt(0)),
    walletHmac: Uint8Array.from("walletHmacBuffer", (c) => c.charCodeAt(0)),
    change: false,
    addressIndex: 0x00000000,
  };

  beforeEach(() => {
    command = new GetWalletAddressCommand(defaultArgs);
    vi.clearAllMocks();
    vi.importActual("@ledgerhq/device-management-kit");
  });

  describe("getApdu", () => {
    it("should return correct APDU for default arguments", () => {
      const apdu = command.getApdu();
      const expectedApdu = Uint8Array.from([
        0xe1, // CLA
        0x03, // INS
        0x00, // P1
        0x01, // P2
        0x24, // Length of data: 36 bytes
        0x01, // checkOnDevice: true
        ...Uint8Array.from("walletIdBuffer", (c) => c.charCodeAt(0)),
        ...Uint8Array.from("walletHmacBuffer", (c) => c.charCodeAt(0)),
        0x00, // change: false
        0x00,
        0x00,
        0x00,
        0x00, // addressIndex: 0x00000000
      ]);
      expect(apdu.getRawApdu()).toEqual(expectedApdu);
    });

    it("should return correct APDU for different arguments", () => {
      const args: GetWalletAddressCommandArgs = {
        checkOnDevice: false,
        walletId: Uint8Array.from("anotherWalletId", (c) => c.charCodeAt(0)),
        walletHmac: Uint8Array.from("anotherWalletHmac", (c) =>
          c.charCodeAt(0),
        ),
        change: true,
        addressIndex: 0x00000005,
      };
      command = new GetWalletAddressCommand(args);
      const apdu = command.getApdu();
      const expectedApdu = Uint8Array.from([
        0xe1, // CLA
        0x03, // INS
        0x00, // P1
        0x01, // P2
        0x26, // Length of data
        0x00, // checkOnDevice: false
        ...Uint8Array.from("anotherWalletId", (c) => c.charCodeAt(0)),
        ...Uint8Array.from("anotherWalletHmac", (c) => c.charCodeAt(0)),
        0x01, // change: true
        0x00,
        0x00,
        0x00,
        0x05, // addressIndex: 0x00000005
      ]);
      expect(apdu.getRawApdu()).toEqual(expectedApdu);
    });
  });

  describe("parseResponse", () => {
    it("should return the APDU response if it's a continue response", () => {
      // given
      const continueResponseData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

      const apduResponse = new ApduResponse({
        statusCode: SW_INTERRUPTED_EXECUTION,
        data: continueResponseData,
      });

      // when
      const response = command.parseResponse(apduResponse);

      // then
      expect(response).toStrictEqual(
        CommandResultFactory({
          data: apduResponse,
        }),
      );
    });

    it("should return an error if user denied the operation", () => {
      // given
      const apduResponse = new ApduResponse({
        statusCode: USER_DENIED_STATUS,
        data: new Uint8Array([]),
      });

      // when
      const response = command.parseResponse(apduResponse);

      // then
      expect(isSuccessCommandResult(response)).toBe(false);
      if (!isSuccessCommandResult(response)) {
        expect(response.error).toBeDefined();
      }
    });

    it("should return correct data when response is not empty", () => {
      // given
      const responseData = Uint8Array.from("addressData", (c) =>
        c.charCodeAt(0),
      );

      const apduResponse = new ApduResponse({
        statusCode: SUCCESS_STATUS,
        data: responseData,
      });

      // when
      const response = command.parseResponse(apduResponse);

      // then
      expect(response).toStrictEqual(
        CommandResultFactory({ data: apduResponse }),
      );
    });
  });
});
