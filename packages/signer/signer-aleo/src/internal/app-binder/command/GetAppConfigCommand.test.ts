import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { GetAppConfigCommand } from "@internal/app-binder/command/GetAppConfigCommand";

const GET_APP_CONFIG_APDU = new Uint8Array([0xe0, 0x03, 0x00, 0x00, 0x00]);

const GET_APP_CONFIG_RESPONSE_DATA = new Uint8Array([0x00, 0x01, 0x02]);

const GET_APP_CONFIG_RESPONSE = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: GET_APP_CONFIG_RESPONSE_DATA,
});

describe("GetAppConfigurationCommand", () => {
  let command: GetAppConfigCommand;

  beforeEach(() => {
    command = new GetAppConfigCommand();
    vi.clearAllMocks();
    vi.importActual("@ledgerhq/device-management-kit");
  });

  describe("name", () => {
    it("should be 'getAppConfiguration'", () => {
      expect(command.name).toBe("GetAppConfig");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toEqual(GET_APP_CONFIG_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should parse the response correctly", () => {
      const parsed = command.parseResponse(GET_APP_CONFIG_RESPONSE);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            version: "0.1.2",
          },
        }),
      );
    });

    describe("error handling", () => {
      it("should return error if response is not success", () => {
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x6a, 0x86]),
          data: new Uint8Array(0),
        });
        const result = command.parseResponse(response);
        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toEqual(
            expect.objectContaining({
              _tag: "AleoAppCommandError",
              errorCode: "6a86",
              message: "Incorrect P1 or P2",
            }),
          );
        } else {
          assert.fail("Expected error");
        }
      });
    });
  });
});
