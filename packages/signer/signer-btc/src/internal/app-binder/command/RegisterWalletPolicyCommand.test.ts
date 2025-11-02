import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SW_INTERRUPTED_EXECUTION } from "./utils/constants";
import {
  RegisterWalletPolicyCommand,
  type RegisterWalletPolicyCommandArgs,
} from "./RegisterWalletPolicyCommand";

const SUCCESS_STATUS = new Uint8Array([0x90, 0x00]);
const USER_DENIED_STATUS = new Uint8Array([0x69, 0x85]);

describe("RegisterWalletPolicyCommand", () => {
  let command: RegisterWalletPolicyCommand;

  const defaultArgs: RegisterWalletPolicyCommandArgs = {
    walletPolicy: Uint8Array.from("policyWallet", (c) => c.charCodeAt(0)),
  };

  beforeEach(() => {
    command = new RegisterWalletPolicyCommand(defaultArgs);
    vi.clearAllMocks();
    vi.importActual("@ledgerhq/device-management-kit");
  });

  describe("getApdu", () => {
    it("should return correct APDU for default arguments", () => {
      const apdu = command.getApdu();

      const expectedApdu = Uint8Array.from([
        0xe1, // CLA
        0x02, // INS
        0x00, // P1
        0x00, // P2
        0xd, // Lc: 13
        0xc, // length of data: 12
        ...Uint8Array.from("policyWallet", (c) => c.charCodeAt(0)),
      ]);

      expect(apdu.getRawApdu()).toEqual(expectedApdu);
    });

    it("should return correct APDU for different arguments", () => {
      const args: RegisterWalletPolicyCommandArgs = {
        walletPolicy: Uint8Array.from("test", (c) => c.charCodeAt(0)),
      };
      command = new RegisterWalletPolicyCommand(args);

      const apdu = command.getApdu();
      const expectedApdu = Uint8Array.from([
        0xe1, // CLA
        0x02, // INS
        0x00, // P1
        0x00, // P2
        0x5, // Lc: 5
        0x4, // length of data: 4
        ...Uint8Array.from("test", (c) => c.charCodeAt(0)),
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
      const responseData = Uint8Array.from("walletIdentity", (c) =>
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
