import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetAddressCommand } from "./GetAddressCommand";

const GET_ADDRESS_APDU = Uint8Array.from([
  0xe0, 0x02, 0x00, 0x00, 0x1d, 0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00,
  0x3c, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
]);

const GET_ADDRESS_APDU_WITH_CHECK_ON_DEVICE = Uint8Array.from([
  0xe0, 0x02, 0x01, 0x00, 0x1d, 0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00,
  0x3c, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
]);

const GET_ADDRESS_APDU_WITH_RETURN_CHAIN_CODE = Uint8Array.from([
  0xe0, 0x02, 0x00, 0x01, 0x1d, 0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00,
  0x3c, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
]);

const GET_ADDRESS_APDU_WITH_CHECK_ON_DEVICE_WITH_RETURN_CHAIN_CODE =
  Uint8Array.from([
    0xe0, 0x02, 0x01, 0x01, 0x1d, 0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00,
    0x00, 0x3c, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
  ]);

const GET_ADDRESS_APDU_WITH_CUSTOM_DERIVATION_PATH = Uint8Array.from([
  0xe0, 0x02, 0x00, 0x00, 0x1d, 0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00,
  0x3c, 0x80, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
]);

const LNX_RESPONSE_DATA_GOOD = Uint8Array.from([
  0x41, 0x04, 0xe3, 0x78, 0x5c, 0xa6, 0xa5, 0xaa, 0x74, 0x8c, 0x62, 0x5e, 0x3d,
  0xdd, 0xd6, 0xd9, 0x7b, 0x59, 0xb2, 0x6f, 0xd8, 0x15, 0x2f, 0xb5, 0x2e, 0xb2,
  0x9d, 0x24, 0x40, 0x4f, 0x01, 0x0b, 0xe4, 0xf7, 0x25, 0xc3, 0x72, 0x5e, 0x78,
  0xbe, 0xd9, 0x53, 0xf0, 0x74, 0x77, 0x8d, 0x71, 0x79, 0x74, 0xde, 0x21, 0xf3,
  0x47, 0x0b, 0x73, 0x57, 0x36, 0xeb, 0x3d, 0x56, 0x74, 0x7a, 0xb6, 0xd0, 0x73,
  0xa7, 0x28, 0x46, 0x37, 0x43, 0x36, 0x39, 0x42, 0x65, 0x64, 0x42, 0x32, 0x39,
  0x32, 0x44, 0x64, 0x33, 0x66, 0x43, 0x32, 0x63, 0x41, 0x34, 0x31, 0x30, 0x33,
  0x39, 0x38, 0x39, 0x42, 0x35, 0x42, 0x44, 0x37, 0x30, 0x35, 0x31, 0x36, 0x34,
  0x63, 0x34, 0x33,
]);

const LNX_RESPONSE_GOOD = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: LNX_RESPONSE_DATA_GOOD,
});

const LNX_RESPONSE_DATA_GOOD_WITH_CHAIN_CODE = Uint8Array.from([
  0x41, 0x4, 0xe3, 0x78, 0x5c, 0xa6, 0xa5, 0xaa, 0x74, 0x8c, 0x62, 0x5e, 0x3d,
  0xdd, 0xd6, 0xd9, 0x7b, 0x59, 0xb2, 0x6f, 0xd8, 0x15, 0x2f, 0xb5, 0x2e, 0xb2,
  0x9d, 0x24, 0x40, 0x4f, 0x1, 0xb, 0xe4, 0xf7, 0x25, 0xc3, 0x72, 0x5e, 0x78,
  0xbe, 0xd9, 0x53, 0xf0, 0x74, 0x77, 0x8d, 0x71, 0x79, 0x74, 0xde, 0x21, 0xf3,
  0x47, 0xb, 0x73, 0x57, 0x36, 0xeb, 0x3d, 0x56, 0x74, 0x7a, 0xb6, 0xd0, 0x73,
  0xa7, 0x28, 0x46, 0x37, 0x43, 0x36, 0x39, 0x42, 0x65, 0x64, 0x42, 0x32, 0x39,
  0x32, 0x44, 0x64, 0x33, 0x66, 0x43, 0x32, 0x63, 0x41, 0x34, 0x31, 0x30, 0x33,
  0x39, 0x38, 0x39, 0x42, 0x35, 0x42, 0x44, 0x37, 0x30, 0x35, 0x31, 0x36, 0x34,
  0x63, 0x34, 0x33, 0x42, 0x3e, 0x65, 0x1f, 0x2b, 0x16, 0xb4, 0x18, 0x6d, 0x5e,
  0xac, 0x16, 0x7c, 0xc4, 0x9a, 0xad, 0xe4, 0xa9, 0x7e, 0xb3, 0xb1, 0x37, 0xde,
  0x36, 0x33, 0x47, 0x99, 0x68, 0x4d, 0xc, 0x71, 0x4a,
]);

const LNX_RESPONSE_GOOD_WITH_CHAIN_CODE = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: LNX_RESPONSE_DATA_GOOD_WITH_CHAIN_CODE,
});

describe("GetAddressCommand", () => {
  let command: GetAddressCommand;
  const defaultArgs = {
    derivationPath: "44'/60'/0'/0/0",
    checkOnDevice: false,
    returnChainCode: false,
  };

  beforeEach(() => {
    command = new GetAddressCommand(defaultArgs);
  });

  describe("getApdu", () => {
    it("should return the GetAddress apdu with default args", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(GET_ADDRESS_APDU);
    });

    it("should return the GetAddress apdu with checkOnDevice set to true", () => {
      command = new GetAddressCommand({ ...defaultArgs, checkOnDevice: true });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_ADDRESS_APDU_WITH_CHECK_ON_DEVICE,
      );
    });

    it("should return the GetAddress apdu with returnChainCode set to true", () => {
      command = new GetAddressCommand({
        ...defaultArgs,
        returnChainCode: true,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_ADDRESS_APDU_WITH_RETURN_CHAIN_CODE,
      );
    });

    it("should return the GetAddress apdu with checkOnDevice and returnChainCode set to true", () => {
      command = new GetAddressCommand({
        ...defaultArgs,
        checkOnDevice: true,
        returnChainCode: true,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_ADDRESS_APDU_WITH_CHECK_ON_DEVICE_WITH_RETURN_CHAIN_CODE,
      );
    });

    it("should return the GetAddress apdu with a custom derivation path", () => {
      const customDerivationPath = "44'/60'/3'/2/1";
      command = new GetAddressCommand({
        ...defaultArgs,
        derivationPath: customDerivationPath,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_ADDRESS_APDU_WITH_CUSTOM_DERIVATION_PATH,
      );
    });
  });

  describe("parseResponse", () => {
    it("should parse the response", () => {
      const parsed = command.parseResponse(LNX_RESPONSE_GOOD);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            publicKey:
              "04e3785ca6a5aa748c625e3dddd6d97b59b26fd8152fb52eb29d24404f010be4f725c3725e78bed953f074778d717974de21f3470b735736eb3d56747ab6d073a7",
            address: "0xF7C69BedB292Dd3fC2cA4103989B5BD705164c43",
            chainCode: undefined,
          },
        }),
      );
    });

    it("should parse the response with chainCode", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (command as any)["args"].returnChainCode = true;
      const parsed = command.parseResponse(LNX_RESPONSE_GOOD_WITH_CHAIN_CODE);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            publicKey:
              "04e3785ca6a5aa748c625e3dddd6d97b59b26fd8152fb52eb29d24404f010be4f725c3725e78bed953f074778d717974de21f3470b735736eb3d56747ab6d073a7",
            address: "0xF7C69BedB292Dd3fC2cA4103989B5BD705164c43",
            chainCode:
              "423e651f2b16b4186d5eac167cc49aade4a97eb3b137de36334799684d0c714a",
          },
        }),
      );
    });

    it("should not return chainCode if it is not requested", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (command as any)["args"].returnChainCode = false;
      const parsed = command.parseResponse(LNX_RESPONSE_GOOD_WITH_CHAIN_CODE);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            publicKey:
              "04e3785ca6a5aa748c625e3dddd6d97b59b26fd8152fb52eb29d24404f010be4f725c3725e78bed953f074778d717974de21f3470b735736eb3d56747ab6d073a7",
            address: "0xF7C69BedB292Dd3fC2cA4103989B5BD705164c43",
            chainCode: undefined,
          },
        }),
      );
    });

    describe("should return an error", () => {
      it("when the response is not successfull", () => {
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x6d, 0x00]),
          data: new Uint8Array(0),
        });
        const result = command.parseResponse(response);
        expect(isSuccessCommandResult(result)).toBe(false);
      });

      it("when publicKeyLength is invalid", () => {
        // GIVEN
        const response = {
          data: Uint8Array.from([]), // Invalid public key length
          statusCode: Uint8Array.from([0x90, 0x00]), // Success status code
        };

        // WHEN
        const result = command.parseResponse(response);

        // THEN
        if (isSuccessCommandResult(result)) {
          assert.fail("Expected an error");
        } else {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
          expect(result.error.originalError).toEqual(
            new Error("Public key length is missing"),
          );
        }
      });

      it("when publicKey is invalid", () => {
        // GIVEN
        const response = {
          data: Uint8Array.from([0x01]), // Invalid public key
          statusCode: Uint8Array.from([0x90, 0x00]), // Success status code
        };

        // WHEN
        const result = command.parseResponse(response);

        // THEN
        if (isSuccessCommandResult(result)) {
          assert.fail("Expected an error");
        } else {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
          expect(result.error.originalError).toEqual(
            new Error("Public key is missing"),
          );
        }
      });

      it("when addressLength is invalid", () => {
        // GIVEN
        const response = {
          data: Uint8Array.from([0x20, ...Array<number>(32).fill(0x02)]), // Invalid address length
          statusCode: Uint8Array.from([0x90, 0x00]), // Success status code
        };

        // WHEN
        const result = command.parseResponse(response);

        // THEN
        if (isSuccessCommandResult(result)) {
          assert.fail("Expected an error");
        } else {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
          expect(result.error.originalError).toEqual(
            new Error("Ethereum address length is missing"),
          );
        }
      });

      it("when address is missing", () => {
        // GIVEN
        const response = {
          data: Uint8Array.from([0x20, ...Array<number>(32).fill(0x02), 0x01]), // Invalid address
          statusCode: Uint8Array.from([0x90, 0x00]), // Success status code
        };

        // WHEN
        const result = command.parseResponse(response);

        // THEN
        if (isSuccessCommandResult(result)) {
          assert.fail("Expected an error");
        } else {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
          expect(result.error.originalError).toEqual(
            new Error("Ethereum address is missing"),
          );
        }
      });

      it("when the address is invalid", () => {
        // GIVEN
        const response = {
          data: Uint8Array.from([
            0x20,
            ...Array<number>(32).fill(0x02),
            0x01,
            0x02,
          ]), // Invalid address
          statusCode: Uint8Array.from([0x90, 0x00]), // Success status code
        };

        // WHEN
        const result = command.parseResponse(response);

        // THEN
        if (isSuccessCommandResult(result)) {
          assert.fail("Expected an error");
        } else {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
          expect(result.error.originalError).toEqual(
            new Error("Invalid Ethereum address"),
          );
        }
      });

      it("when chainCode is invalid", () => {
        // GIVEN
        const response = {
          data: LNX_RESPONSE_DATA_GOOD_WITH_CHAIN_CODE.slice(0, -1), // Invalid chainCode
          statusCode: Uint8Array.from([0x90, 0x00]), // Success status code
        };

        // WHEN
        const commandWithChainCode = new GetAddressCommand({
          ...defaultArgs,
          returnChainCode: true,
        });
        const result = commandWithChainCode.parseResponse(response);

        // THEN
        if (isSuccessCommandResult(result)) {
          assert.fail("Expected an error");
        } else {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
          expect(result.error.originalError).toEqual(
            new Error("Invalid Chaincode"),
          );
        }
      });
    });
  });
});
