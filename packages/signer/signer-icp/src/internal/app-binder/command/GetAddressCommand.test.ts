import {
  ApduBuilder,
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import {
  GetAddressCommand,
  icpGetAddressApduHeader,
  P1_CHECK_ON_DEVICE,
  P1_NO_CHECK_ON_DEVICE,
} from "@internal/app-binder/command/GetAddressCommand";
import {
  type IcpAppCommandError,
  IcpErrorCodes,
} from "@internal/app-binder/command/utils/IcpApplicationErrors";

const DERIVATION_PATH = "44'/223'/0'/0/0";

const pathToBuffer = (derivationPath: string): Uint8Array => {
  const parts = DerivationPathUtils.splitPath(derivationPath);
  const view = new DataView(new ArrayBuffer(20));
  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i]! & 0x7fffffff;
    const hardened = i < 3 ? (0x80000000 | raw) >>> 0 : raw >>> 0;
    view.setUint32(i * 4, hardened, true);
  }
  return new Uint8Array(view.buffer);
};

const buildAddressResponseData = (
  publicKey: Uint8Array,
  accountId: Uint8Array,
  principal: Uint8Array,
): Uint8Array => {
  const data = new Uint8Array(
    publicKey.length + 1 + accountId.length + 1 + principal.length,
  );
  let offset = 0;
  data.set(publicKey, offset);
  offset += publicKey.length;
  data[offset++] = accountId.length;
  data.set(accountId, offset);
  offset += accountId.length;
  data[offset++] = principal.length;
  data.set(principal, offset);
  return data;
};

describe("GetAddressCommand", () => {
  describe("getApdu", () => {
    it("should build APDU with CLA=0x11, INS=0x01, P1=no-check when checkOnDevice is false", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        skipOpenApp: false,
      });
      const expected = new ApduBuilder(
        icpGetAddressApduHeader(P1_NO_CHECK_ON_DEVICE),
      )
        .addBufferToData(pathToBuffer(DERIVATION_PATH))
        .build();
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.getRawApdu());
    });

    it("should set P1 to check-on-device when checkOnDevice is true", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: true,
        skipOpenApp: false,
      });
      const expected = new ApduBuilder(
        icpGetAddressApduHeader(P1_CHECK_ON_DEVICE),
      )
        .addBufferToData(pathToBuffer(DERIVATION_PATH))
        .build();
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.getRawApdu());
    });

    it("should throw when path does not have 5 elements", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: "44'/223'/0'",
        checkOnDevice: false,
        skipOpenApp: false,
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "GetAddressCommand: expected 5 path elements, got 3",
      );
    });
  });

  describe("parseResponse", () => {
    it("should extract publicKey, accountId and principal on success", () => {
      // ARRANGE
      const publicKey = new Uint8Array(65).fill(0x02);
      const accountId = new Uint8Array(32).fill(0x0a);
      const principal = new TextEncoder().encode("2vxsx-fae");
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: buildAddressResponseData(publicKey, accountId, principal),
      });
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        skipOpenApp: false,
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.publicKey).toBe("02".repeat(65));
        expect(result.data.accountId).toBe("0a".repeat(32));
        expect(result.data.principal).toBe("2vxsx-fae");
      }
    });

    it("should reject a response with a zero-length account identifier", () => {
      // ARRANGE
      const publicKey = new Uint8Array(65).fill(0x02);
      const principal = new TextEncoder().encode("2vxsx-fae");
      const data = buildAddressResponseData(
        publicKey,
        new Uint8Array(0),
        principal,
      );
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data,
      });
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        skipOpenApp: false,
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should reject a response with a zero-length principal", () => {
      // ARRANGE
      const publicKey = new Uint8Array(65).fill(0x02);
      const accountId = new Uint8Array(32).fill(0x0a);
      const data = buildAddressResponseData(
        publicKey,
        accountId,
        new Uint8Array(0),
      );
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data,
      });
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        skipOpenApp: false,
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return an error when the principal length is missing", () => {
      // ARRANGE
      const publicKey = new Uint8Array(65).fill(0x02);
      const accountId = new Uint8Array(32).fill(0x0a);
      const truncated = new Uint8Array(65 + 1 + 32);
      truncated.set(publicKey, 0);
      truncated[65] = accountId.length;
      truncated.set(accountId, 66);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: truncated,
      });
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        skipOpenApp: false,
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return IcpAppCommandError when status word signals an error", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x82]),
        data: new Uint8Array(0),
      });
      const command = new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        skipOpenApp: false,
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as IcpAppCommandError;
        expect((err.originalError as { errorCode: string }).errorCode).toBe(
          IcpErrorCodes.EMPTY_BUFFER.slice(2),
        );
      }
    });
  });
});
