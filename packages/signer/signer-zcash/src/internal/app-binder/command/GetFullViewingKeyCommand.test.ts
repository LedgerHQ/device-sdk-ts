import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  GetFullViewingKeyCommand,
  P2_VK,
} from "@internal/app-binder/command/GetFullViewingKeyCommand";
import { type ZcashAppCommandError } from "@internal/app-binder/command/utils/zcashApplicationErrors";

// m/44'/133'/0'/0/0 — same path bytes as GetAddress tests
const GET_FVK_PATH_BYTES = Uint8Array.from([
  0x15, // Data length: 21
  0x05,
  0x80,
  0x00,
  0x00,
  0x2c,
  0x80,
  0x00,
  0x00,
  0x85,
  0x80,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
]);

// UFVK export (app-zcash >= v3.8.0): orchard ZIP-32 path 32'/133'/0' followed
// by the transparent account path 44'/133'/0'.
const GET_FVK_UFVK_PATH_BYTES = Uint8Array.from([
  0x1a, // Data length: 26
  0x03, // orchard path length: 3
  0x80,
  0x00,
  0x00,
  0x20, // 32'
  0x80,
  0x00,
  0x00,
  0x85, // 133'
  0x80,
  0x00,
  0x00,
  0x00, // 0'
  0x03, // transparent path length: 3
  0x80,
  0x00,
  0x00,
  0x2c, // 44'
  0x80,
  0x00,
  0x00,
  0x85, // 133'
  0x80,
  0x00,
  0x00,
  0x00, // 0'
]);

const GET_FVK_UFVK_FIRST_APDU = Uint8Array.from([
  0xe0,
  0x50,
  0x00,
  P2_VK.UFVK,
  ...GET_FVK_UFVK_PATH_BYTES,
]);

const GET_FVK_ORCHARD_FIRST_APDU = Uint8Array.from([
  0xe0,
  0x50,
  0x00,
  P2_VK.ORCHARD_FVK,
  ...GET_FVK_PATH_BYTES,
]);

const GET_FVK_CONTINUE_UFVK_APDU = Uint8Array.from([
  0xe0,
  0x50,
  0x80,
  P2_VK.UFVK,
  0x00,
]);

describe("GetFullViewingKeyCommand", () => {
  const path = "44'/133'/0'/0/0";
  const orchardPath = "32'/133'/0'";
  const transparentPath = "44'/133'/0'";

  describe("name", () => {
    it("should be 'GetFullViewingKey'", () => {
      const command = new GetFullViewingKeyCommand({
        isContinue: false,
        p2: P2_VK.UFVK,
        derivationPath: path,
      });
      expect(command.name).toBe("GetFullViewingKey");
    });
  });

  describe("getApdu", () => {
    it("should return first GET_VK APDU for UFVK (P2=0) with orchard + transparent paths", () => {
      const command = new GetFullViewingKeyCommand({
        isContinue: false,
        p2: P2_VK.UFVK,
        derivationPath: orchardPath,
        transparentDerivationPath: transparentPath,
      });
      expect(command.getApdu().getRawApdu()).toStrictEqual(
        GET_FVK_UFVK_FIRST_APDU,
      );
    });

    it("should return first GET_VK APDU for Orchard (P2=1)", () => {
      const command = new GetFullViewingKeyCommand({
        isContinue: false,
        p2: P2_VK.ORCHARD_FVK,
        derivationPath: path,
      });
      expect(command.getApdu().getRawApdu()).toStrictEqual(
        GET_FVK_ORCHARD_FIRST_APDU,
      );
    });

    it("should return CONTINUE APDU with empty data", () => {
      const command = new GetFullViewingKeyCommand({
        isContinue: true,
        p2: P2_VK.UFVK,
      });
      expect(command.getApdu().getRawApdu()).toStrictEqual(
        GET_FVK_CONTINUE_UFVK_APDU,
      );
    });
  });

  describe("parseResponse", () => {
    it("should return response data chunk on success", () => {
      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      const command = new GetFullViewingKeyCommand({
        isContinue: false,
        p2: P2_VK.UFVK,
        derivationPath: path,
      });
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: new Uint8Array([0x90, 0x00]),
          data: payload,
        }),
      );
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.data).toStrictEqual(payload);
      }
    });

    it("should map device error status to Zcash app error", () => {
      const command = new GetFullViewingKeyCommand({
        isContinue: false,
        p2: P2_VK.UFVK,
        derivationPath: path,
      });
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: new Uint8Array([0x6b, 0x00]),
          data: new Uint8Array(),
        }),
      );
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect((result.error as ZcashAppCommandError).errorCode).toBe("6b00");
      }
    });

    it("should map status 0xB007 to BadStateError", () => {
      const command = new GetFullViewingKeyCommand({
        isContinue: false,
        p2: P2_VK.UFVK,
        derivationPath: path,
      });
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: new Uint8Array([0xb0, 0x07]),
          data: new Uint8Array(),
        }),
      );
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as ZcashAppCommandError;
        expect(err.errorCode).toBe("b007");
        expect(err.message).toBe("BadStateError");
      }
    });
  });
});
