import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import {
  SignTransactionCommand,
  SignTransactionCommandArgs,
} from "./SignTransactionCommand";

const LNX_RESPONSE_GOOD = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: new Uint8Array([]),
});

const LNX_RESPONSE_DATA = new Uint8Array([
  0x26, 0x8d, 0x27, 0x44, 0x47, 0x11, 0xbb, 0xed, 0x44, 0x2b, 0x9b, 0xfc, 0x77,
  0x05, 0xc0, 0x73, 0x16, 0xb7, 0xe4, 0x11, 0x50, 0xc5, 0x33, 0x12, 0x72, 0xe4,
  0xd2, 0x09, 0xd4, 0x22, 0xf9, 0xfa, 0x39, 0x00, 0xcc, 0x3f, 0x0c, 0x19, 0x38,
  0xc0, 0xf1, 0xff, 0xc6, 0x2d, 0xf0, 0x37, 0x22, 0x5a, 0x13, 0x36, 0xfb, 0xa1,
  0xf9, 0xfe, 0xfa, 0x11, 0xf5, 0xaf, 0xc5, 0xbc, 0xb9, 0x7e, 0xb1, 0xb3, 0xd1,
  0x90, 0x00,
]);

const LNX_RESPONSE_DATA_GOOD = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: LNX_RESPONSE_DATA,
});

describe("SignTransactionCommand", () => {
  const defaultArgs: SignTransactionCommandArgs = {
    serializedTransaction: new Uint8Array(),
    isFirstChunk: true,
  };

  describe("getApdu", () => {
    describe("Legacy", () => {
      it("should return the correct APDU when the data is empty", () => {
        // GIVEN
        const command = new SignTransactionCommand({
          ...defaultArgs,
        });

        // WHEN
        const apdu = command.getApdu();

        // THEN
        expect(apdu.data).toStrictEqual(new Uint8Array());
        expect(apdu.cla).toBe(0xe0);
        expect(apdu.ins).toBe(0x04);
        expect(apdu.p1).toBe(0x00);
        expect(apdu.p2).toBe(0x00);
      });

      it("should return the correct APDU when the data is not empty", () => {
        // GIVEN
        const command = new SignTransactionCommand({
          ...defaultArgs,
          serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
        });

        // WHEN
        const apdu = command.getApdu();

        // THEN
        expect(apdu.data).toStrictEqual(new Uint8Array([0x01, 0x02, 0x03]));
        expect(apdu.cla).toBe(0xe0);
        expect(apdu.ins).toBe(0x04);
        expect(apdu.p1).toBe(0x00);
        expect(apdu.p2).toBe(0x00);
      });

      it("should return the correct APDU when it is not the first chunk", () => {
        // GIVEN
        const command = new SignTransactionCommand({
          ...defaultArgs,
          isFirstChunk: false,
        });

        // WHEN
        const apdu = command.getApdu();

        // THEN
        expect(apdu.data).toStrictEqual(new Uint8Array());
        expect(apdu.cla).toBe(0xe0);
        expect(apdu.ins).toBe(0x04);
        expect(apdu.p1).toBe(0x80);
        expect(apdu.p2).toBe(0x00);
      });
    });

    describe("Store and start", () => {
      // TODO
    });

    describe("Start", () => {
      // TODO
    });
  });

  describe("parseResponse", () => {
    it("should return Nothing when the response data is empty", () => {
      // GIVEN
      const command = new SignTransactionCommand({
        ...defaultArgs,
      });

      // WHEN
      const response = command.parseResponse(LNX_RESPONSE_GOOD);

      // THEN
      expect(response).toStrictEqual(CommandResultFactory({ data: Nothing }));
    });

    it("should return Just the response data when the response data is not empty", () => {
      // GIVEN
      const command = new SignTransactionCommand({
        ...defaultArgs,
      });

      // WHEN
      const response = command.parseResponse(LNX_RESPONSE_DATA_GOOD);

      // THEN
      expect(response).toStrictEqual(
        CommandResultFactory({
          data: Just({
            r: "0x8d27444711bbed442b9bfc7705c07316b7e41150c5331272e4d209d422f9fa39",
            s: "0x00cc3f0c1938c0f1ffc62df037225a1336fba1f9fefa11f5afc5bcb97eb1b3d1",
            v: 38,
          }),
        }),
      );
    });

    it("should return a UnknownDeviceExchangeError when the response status code is not 0x9000", () => {
      // GIVEN
      const command = new SignTransactionCommand({
        ...defaultArgs,
      });

      // WHEN
      const response = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x51, 0x55]),
          data: new Uint8Array(),
        }),
      );

      // THEN
      expect(isSuccessCommandResult(response)).toBe(false);
      // @ts-expect-error `error`is not typed because we did not narrow it
      expect(response.error).toBeInstanceOf(UnknownDeviceExchangeError);
    });

    it("should return an InvalidStatusWord error when the response data r is not valid", () => {
      // GIVEN
      const command = new SignTransactionCommand({
        ...defaultArgs,
      });

      // WHEN
      const response = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: LNX_RESPONSE_DATA.slice(0, 1),
        }),
      );

      // THEN
      expect(isSuccessCommandResult(response)).toBe(false);
      // @ts-expect-error `error`is not typed because we did not narrow it
      expect(response.error).toBeInstanceOf(InvalidStatusWordError);
    });

    it("should return an error when the response data s is not valid", () => {
      // GIVEN
      const command = new SignTransactionCommand({
        ...defaultArgs,
      });

      // WHEN
      const response = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: LNX_RESPONSE_DATA.slice(0, 33),
        }),
      );

      // THEN
      expect(isSuccessCommandResult(response)).toBe(false);
    });
  });
});
