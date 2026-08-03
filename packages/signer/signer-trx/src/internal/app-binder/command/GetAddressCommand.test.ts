import {
  ApduBuilder,
  ApduResponse,
  type InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { INS, LEDGER_CLA } from "@internal/app-binder/constants";

import { encodeDerivationPath } from "./utils/encodeDerivationPath";
import { type TronAppCommandError } from "./utils/tronApplicationErrors";
import { GetAddressCommand } from "./GetAddressCommand";

const PATH = "44'/195'/0'/0/0";
const ADDRESS = "TWdnWBzFdBP1b8sqZ5RcFDbkV3sBmnxsYu";

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

describe("GetAddressCommand", () => {
  describe("name", () => {
    it("should be 'GetAddress'", () => {
      expect(new GetAddressCommand({ derivationPath: PATH }).name).toBe(
        "GetAddress",
      );
    });
  });

  describe("getApdu", () => {
    it("should build the APDU with CLA=0xe0, INS=0x02, P1=0, P2=0 by default", () => {
      const command = new GetAddressCommand({ derivationPath: PATH });
      const expected = new ApduBuilder({
        cla: LEDGER_CLA,
        ins: INS.GET_ADDRESS,
        p1: 0x00,
        p2: 0x00,
      })
        .addBufferToData(encodeDerivationPath(PATH))
        .build();

      expect(command.getApdu().getRawApdu()).toStrictEqual(
        expected.getRawApdu(),
      );
    });

    it("should set P1=0x01 when checkOnDevice and P2=0x01 when returnChainCode", () => {
      const command = new GetAddressCommand({
        derivationPath: PATH,
        checkOnDevice: true,
        returnChainCode: true,
      });
      const expected = new ApduBuilder({
        cla: LEDGER_CLA,
        ins: INS.GET_ADDRESS,
        p1: 0x01,
        p2: 0x01,
      })
        .addBufferToData(encodeDerivationPath(PATH))
        .build();

      expect(command.getApdu().getRawApdu()).toStrictEqual(
        expected.getRawApdu(),
      );
    });
  });

  describe("parseResponse", () => {
    const buildResponse = (
      publicKey: Uint8Array,
      address: string,
      chainCode?: Uint8Array,
    ): ApduResponse => {
      const addressBytes = new TextEncoder().encode(address);
      const parts = [
        Uint8Array.of(publicKey.length),
        publicKey,
        Uint8Array.of(addressBytes.length),
        addressBytes,
        ...(chainCode ? [chainCode] : []),
      ];
      const total = parts.reduce((n, p) => n + p.length, 0);
      const data = new Uint8Array(total);
      let offset = 0;
      for (const part of parts) {
        data.set(part, offset);
        offset += part.length;
      }
      return new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data,
      });
    };

    it("should parse the public key (hex) and Base58 address", () => {
      const publicKey = Uint8Array.from({ length: 65 }, (_, i) => i + 1);
      const response = buildResponse(publicKey, ADDRESS);
      const result = new GetAddressCommand({
        derivationPath: PATH,
      }).parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.publicKey).toBe(toHex(publicKey));
        expect(result.data.address).toBe(ADDRESS);
        expect(result.data.chainCode).toBeUndefined();
      }
    });

    it("should parse the chain code when returnChainCode is set", () => {
      const publicKey = Uint8Array.from({ length: 65 }, (_, i) => i + 1);
      const chainCode = new Uint8Array(32).fill(0xab);
      const response = buildResponse(publicKey, ADDRESS, chainCode);
      const result = new GetAddressCommand({
        derivationPath: PATH,
        returnChainCode: true,
      }).parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.chainCode).toBe(toHex(chainCode));
      }
    });

    it("should return a TronAppCommandError on a device error status", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x85]),
        data: new Uint8Array(0),
      });
      const result = new GetAddressCommand({
        derivationPath: PATH,
      }).parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as TronAppCommandError;
        expect(err.errorCode).toBe("6985");
      }
    });

    it("should return an InvalidStatusWordError when the public key is missing", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(0),
      });
      const result = new GetAddressCommand({
        derivationPath: PATH,
      }).parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "Public key is missing",
        );
      }
    });
  });
});
