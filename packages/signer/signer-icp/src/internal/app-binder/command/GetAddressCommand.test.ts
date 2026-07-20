import {
  ApduBuilder,
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { expectStatusWordError } from "@internal/app-binder/command/__test-utils__/expectStatusWordError";
import { pathToBuffer } from "@internal/app-binder/command/__test-utils__/pathToBuffer";
import {
  GetAddressCommand,
  icpGetAddressApduHeader,
  P1_CHECK_ON_DEVICE,
  P1_NO_CHECK_ON_DEVICE,
} from "@internal/app-binder/command/GetAddressCommand";
import { IcpErrorCodes } from "@internal/app-binder/command/utils/IcpApplicationErrors";

const DERIVATION_PATH = "44'/223'/0'/0/0";

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
    const parse = (
      data: Uint8Array,
      statusCode = new Uint8Array([0x90, 0x00]),
    ) =>
      new GetAddressCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        skipOpenApp: false,
      }).parseResponse(new ApduResponse({ statusCode, data }));

    it("should extract publicKey, accountId and principal on success", () => {
      // ACT
      const result = parse(
        buildAddressResponseData(
          new Uint8Array(65).fill(0x02),
          new Uint8Array(32).fill(0x0a),
          new TextEncoder().encode("2vxsx-fae"),
        ),
      );
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.publicKey).toBe("02".repeat(65));
        expect(result.data.accountId).toBe("0a".repeat(32));
        expect(result.data.principal).toBe("2vxsx-fae");
      }
    });

    it.each([
      {
        field: "account identifier",
        accountId: new Uint8Array(0),
        principal: new TextEncoder().encode("2vxsx-fae"),
      },
      {
        field: "principal",
        accountId: new Uint8Array(32).fill(0x0a),
        principal: new Uint8Array(0),
      },
    ])(
      "should reject a response with a zero-length $field",
      ({ accountId, principal }) => {
        // ACT
        const result = parse(
          buildAddressResponseData(
            new Uint8Array(65).fill(0x02),
            accountId,
            principal,
          ),
        );
        // ASSERT
        expect(isSuccessCommandResult(result)).toBe(false);
      },
    );

    it("should return an error when the principal length is missing", () => {
      // ARRANGE — public key + account id present, principal length byte absent
      const truncated = new Uint8Array(65 + 1 + 32);
      truncated.set(new Uint8Array(65).fill(0x02), 0);
      truncated[65] = 32;
      truncated.set(new Uint8Array(32).fill(0x0a), 66);
      // ACT
      const result = parse(truncated);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return IcpAppCommandError when status word signals an error", () => {
      // ACT
      const result = parse(new Uint8Array(0), new Uint8Array([0x69, 0x82]));
      // ASSERT
      expectStatusWordError(result, IcpErrorCodes.EMPTY_BUFFER);
    });
  });
});
