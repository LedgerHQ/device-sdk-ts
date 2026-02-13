import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetViewKeyCommand } from "./GetViewKeyCommand";

const VIEW_KEY = "AViewKey1q7Q7AA6bRb4ipW2Qe7aDS7qaobZSH2qPqZ6FueUR72wL";

const GET_VIEW_KEY_APDU_WITH_CHECK_ON_DEVICE = Uint8Array.from(
  Buffer.from("e00701000d038000002c800002ab00000000", "hex"),
);

const GET_VIEW_KEY_APDU_WITH_CHECK_ON_DEVICE_AND_LONG_DERIVATION_PATH =
  Uint8Array.from(
    Buffer.from("e007010015058000002c8000003c800000010000000200000003", "hex"),
  );

const GET_VIEW_KEY_APDU_WITHOUT_CHECK_ON_DEVICE = Uint8Array.from(
  Buffer.from("e00700000d038000002c800002ab00000000", "hex"),
);

const RESPONSE_DATA = Uint8Array.from(
  Buffer.concat([Buffer.from([0x35]), Buffer.from(VIEW_KEY, "ascii")]),
);

const RESPONSE_GOOD = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: RESPONSE_DATA,
});

describe("GetViewKeyCommand", () => {
  const derivationPath = "44'/683'/0";

  describe("name", () => {
    it("should be 'GetViewKey'", () => {
      const command = new GetViewKeyCommand({ derivationPath });
      expect(command.name).toBe("GetViewKey");
    });
  });

  describe("getApdu", () => {
    it("should return the GetViewKey apdu with checkOnDevice set to true", () => {
      const command = new GetViewKeyCommand({
        derivationPath,
        checkOnDevice: true,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_VIEW_KEY_APDU_WITH_CHECK_ON_DEVICE,
      );
    });

    it("should return the GetViewKey apdu with checkOnDevice set to true and custom derivation path", () => {
      const command = new GetViewKeyCommand({
        derivationPath: "44'/60'/1'/2/3",
        checkOnDevice: true,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_VIEW_KEY_APDU_WITH_CHECK_ON_DEVICE_AND_LONG_DERIVATION_PATH,
      );
    });

    it("should return the GetViewKey apdu with checkOnDevice set to false", () => {
      const command = new GetViewKeyCommand({
        derivationPath,
        checkOnDevice: false,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_VIEW_KEY_APDU_WITHOUT_CHECK_ON_DEVICE,
      );
    });
  });

  describe("parseResponse", () => {
    it("should parse the response", () => {
      const command = new GetViewKeyCommand({ derivationPath });
      const parsed = command.parseResponse(RESPONSE_GOOD);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            viewKey: VIEW_KEY,
          },
        }),
      );
    });

    describe("should return an error", () => {
      it("when the response is not successfull", () => {
        // GIVEN
        const command = new GetViewKeyCommand({ derivationPath });
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x6d, 0x00]),
          data: new Uint8Array(0),
        });

        // WHEN
        const result = command.parseResponse(response);

        // THEN
        expect(isSuccessCommandResult(result)).toBe(false);
      });

      it("when view key is missing (response too short)", () => {
        // GIVEN
        const command = new GetViewKeyCommand({ derivationPath });
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: Uint8Array.from([0x35]), // Only length, no view key
        });

        // WHEN
        const result = command.parseResponse(response);

        // THEN
        if (isSuccessCommandResult(result)) {
          throw new Error("Expected an error");
        } else {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
          expect(result.error.originalError).toEqual(
            new Error("View key is missing"),
          );
        }
      });

      it("when Aleo view key length is missing", () => {
        // GIVEN
        const command = new GetViewKeyCommand({ derivationPath });
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: new Uint8Array(0),
        });

        // WHEN
        const result = command.parseResponse(response);

        // THEN
        if (isSuccessCommandResult(result)) {
          throw new Error("Expected an error");
        } else {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
          expect(result.error.originalError).toEqual(
            new Error("Aleo view key length is missing"),
          );
        }
      });
    });
  });
});
