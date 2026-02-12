import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetAddressCommand } from "./GetAddressCommand";

const ADDRESS =
  "aleo1zcwqycj02lccfuu57dzjhva7w5dpzc7pngl0sxjhp58t6vlnnqxs6lnp6f";

const GET_ADDRESS_APDU_WITH_CHECK_ON_DEVICE = Uint8Array.from(
  Buffer.from("e00501000d038000002c800002ab00000000", "hex"),
);

const GET_ADDRESS_APDU_WITH_CHECK_ON_DEVICE_AND_LONG_DERIVATION_PATH =
  Uint8Array.from(
    Buffer.from("e005010015058000002c8000003c800000010000000200000003", "hex"),
  );

const GET_ADDRESS_APDU_WITHOUT_CHECK_ON_DEVICE = Uint8Array.from(
  Buffer.from("e00500000d038000002c800002ab00000000", "hex"),
);

const RESPONSE_DATA = Uint8Array.from(
  Buffer.concat([Buffer.from([0x3f]), Buffer.from(ADDRESS, "ascii")]),
);

const RESPONSE_GOOD_RAW =
  "3f616c656f317a63777179636a30326c63636675753537647a6a68766137773564707a6337706e676c3073786a687035387436766c6e6e717873366c6e7036669000";

const RESPONSE_GOOD = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: RESPONSE_DATA,
});

describe("GetAddressCommand", () => {
  const derivationPath = "44'/683'/0";

  describe("name", () => {
    it("should be 'GetAddress'", () => {
      const command = new GetAddressCommand({ derivationPath });
      expect(command.name).toBe("GetAddress");
    });
  });

  describe("getApdu", () => {
    it("should return the GetAddress apdu with checkOnDevice set to true", () => {
      const command = new GetAddressCommand({
        derivationPath,
        checkOnDevice: true,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_ADDRESS_APDU_WITH_CHECK_ON_DEVICE,
      );
    });

    it("should return the GetAddress apdu with checkOnDevice set to true and custom derivation path", () => {
      const command = new GetAddressCommand({
        derivationPath: "44'/60'/1'/2/3",
        checkOnDevice: true,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_ADDRESS_APDU_WITH_CHECK_ON_DEVICE_AND_LONG_DERIVATION_PATH,
      );
    });

    it("should return the GetAddress apdu with checkOnDevice set to false", () => {
      const command = new GetAddressCommand({
        derivationPath,
        checkOnDevice: false,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_ADDRESS_APDU_WITHOUT_CHECK_ON_DEVICE,
      );
    });
  });

  describe("parseResponse", () => {
    it("should parse the response", () => {
      const command = new GetAddressCommand({ derivationPath });
      const parsed = command.parseResponse(RESPONSE_GOOD);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            address: ADDRESS,
          },
        }),
      );
    });

    it("should parse the response from raw hex", () => {
      // GIVEN
      const data = Uint8Array.from(
        Buffer.from(
          RESPONSE_GOOD_RAW.substring(0, RESPONSE_GOOD_RAW.length - 4),
          "hex",
        ),
      );
      const statusCode = Uint8Array.from(
        Buffer.from(
          RESPONSE_GOOD_RAW.substring(RESPONSE_GOOD_RAW.length - 4),
          "hex",
        ),
      );
      const response = new ApduResponse({
        data,
        statusCode,
      });
      const command = new GetAddressCommand({
        derivationPath,
        checkOnDevice: true,
      });

      // WHEN
      const parsed = command.parseResponse(response);

      // THEN
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            address: ADDRESS,
          },
        }),
      );
    });

    it("should parse the response with a different address", () => {
      const otherAddress =
        "aleo16m3u6v6k6p6k6p6k6p6k6p6k6p6k6p6k6p6k6p6k6p6k6p6k6p6k6p6k6p";
      const otherResponseData = Uint8Array.from(
        Buffer.concat([
          Buffer.from([0x3f]),
          Buffer.from(otherAddress, "ascii"),
        ]),
      );
      const otherResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: otherResponseData,
      });

      const command = new GetAddressCommand({ derivationPath });
      const parsed = command.parseResponse(otherResponse);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            address: otherAddress,
          },
        }),
      );
    });

    describe("should return an error", () => {
      it("when the response is not successfull", () => {
        // GIVEN
        const command = new GetAddressCommand({ derivationPath });
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x6d, 0x00]),
          data: new Uint8Array(0),
        });

        // WHEN
        const result = command.parseResponse(response);

        // THEN
        expect(isSuccessCommandResult(result)).toBe(false);
      });

      it("when public key is missing (response too short)", () => {
        // GIVEN
        const command = new GetAddressCommand({ derivationPath });
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: Uint8Array.from([0x3f]), // Only length, no address
        });

        // WHEN
        const result = command.parseResponse(response);

        // THEN
        if (isSuccessCommandResult(result)) {
          throw new Error("Expected an error");
        } else {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
          expect(result.error.originalError).toEqual(
            new Error("Public key is missing"),
          );
        }
      });

      it("when Aleo address length is missing", () => {
        // GIVEN
        const command = new GetAddressCommand({ derivationPath });
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
            new Error("Aleo address length is missing"),
          );
        }
      });

      it("when Aleo address length is incorrect (less than expected)", () => {
        // GIVEN
        const command = new GetAddressCommand({ derivationPath });
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: Uint8Array.from([0x3f, ...Array<number>(62).fill(0x02)]), // Length says 63, but only 62 bytes follow
        });

        // WHEN
        const result = command.parseResponse(response);

        // THEN
        if (isSuccessCommandResult(result)) {
          throw new Error("Expected an error");
        } else {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
          expect(result.error.originalError).toEqual(
            new Error("Public key is missing"),
          );
        }
      });

      it("when unable to extract public key", () => {
        // GIVEN
        const command = new GetAddressCommand({ derivationPath });
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: Uint8Array.from([0x3f, ...Array<number>(10).fill(0x00)]), // length 63, but only 10 bytes follow
        });

        // WHEN
        const result = command.parseResponse(response);

        // THEN
        if (isSuccessCommandResult(result)) {
          throw new Error("Expected an error");
        } else {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
          expect(result.error.originalError).toEqual(
            new Error("Public key is missing"),
          );
        }
      });
    });
  });
});
