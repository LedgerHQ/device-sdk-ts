import {
  ApduResponse,
  CommandResultFactory,
  InvalidResponseFormatError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetTvkCommand } from "./GetTvkCommand";

const TVK_BYTES = Uint8Array.from({ length: 32 }, () => 0xab);

// e0 08 00 00 0d 03 8000002c 800002ab 00000000
const GET_TVK_ROOT_APDU = Uint8Array.from(
  Buffer.from("e00800000d038000002c800002ab00000000", "hex"),
);

// e0 08 01 00 0e 03 8000002c 800002ab 00000000 05
const GET_TVK_INDEXED_APDU = Uint8Array.from(
  Buffer.from("e00801000e038000002c800002ab0000000005", "hex"),
);

const RESPONSE_DATA = Uint8Array.from(
  Buffer.concat([Buffer.from([0x20]), Buffer.from(TVK_BYTES)]),
);

const RESPONSE_GOOD = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: RESPONSE_DATA,
});

describe("GetTvkCommand", () => {
  const derivationPath = "44'/683'/0";

  describe("name", () => {
    it("should be 'getTvk'", () => {
      const command = new GetTvkCommand({ derivationPath });
      expect(command.name).toBe("getTvk");
    });
  });

  describe("getApdu", () => {
    it("should return root TVK APDU (P1=0x00) when no transitionIndex", () => {
      const command = new GetTvkCommand({ derivationPath });
      expect(command.getApdu().getRawApdu()).toStrictEqual(GET_TVK_ROOT_APDU);
    });

    it("should return indexed TVK APDU (P1=0x01) when transitionIndex provided", () => {
      const command = new GetTvkCommand({
        derivationPath,
        transitionIndex: 5,
      });
      expect(command.getApdu().getRawApdu()).toStrictEqual(
        GET_TVK_INDEXED_APDU,
      );
    });

    describe("should throw when transitionIndex is invalid", () => {
      it.each([
        ["zero", 0],
        ["negative", -1],
        ["above max (32)", 32],
        ["above max (255)", 255],
        ["float", 1.5],
        ["NaN", NaN],
      ])("%s", (_label, index) => {
        const command = new GetTvkCommand({
          derivationPath,
          transitionIndex: index,
        });
        let error: unknown;
        try {
          command.getApdu();
        } catch (e) {
          error = e;
        }
        expect(error).toBeInstanceOf(InvalidResponseFormatError);
        expect(
          (error as InvalidResponseFormatError).originalError.message,
        ).toMatch(/transitionIndex must be an integer in \[1, 31\]/);
      });
    });
  });

  describe("parseResponse", () => {
    it("should parse the response and return a Uint8Array tvk", () => {
      const command = new GetTvkCommand({ derivationPath });
      const result = command.parseResponse(RESPONSE_GOOD);
      expect(result).toStrictEqual(
        CommandResultFactory({ data: { tvk: TVK_BYTES } }),
      );
    });

    describe("should return an error", () => {
      it("when the response status is not successful", () => {
        const command = new GetTvkCommand({ derivationPath });
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x6d, 0x00]),
          data: new Uint8Array(0),
        });
        expect(isSuccessCommandResult(command.parseResponse(response))).toBe(
          false,
        );
      });

      it("when TVK length byte is missing", () => {
        const command = new GetTvkCommand({ derivationPath });
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: new Uint8Array(0),
        });
        const result = command.parseResponse(response);
        if (isSuccessCommandResult(result)) {
          throw new Error("Expected an error");
        }
        expect(result.error).toBeInstanceOf(InvalidResponseFormatError);
        expect(result.error.originalError).toEqual(
          new Error("Aleo TVK length is missing"),
        );
      });

      it("when TVK data is missing (response too short)", () => {
        const command = new GetTvkCommand({ derivationPath });
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: Uint8Array.from([0x20]), // length byte only, no TVK data
        });
        const result = command.parseResponse(response);
        if (isSuccessCommandResult(result)) {
          throw new Error("Expected an error");
        }
        expect(result.error).toBeInstanceOf(InvalidResponseFormatError);
        expect(result.error.originalError).toEqual(new Error("TVK is missing"));
      });
    });
  });
});
