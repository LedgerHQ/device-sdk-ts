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

// Real device GET_ADDR layout: publicKey(65) · principal(29) · accountId(32) · principalText.
const buildAddressResponseData = (
  publicKey: Uint8Array,
  rawPrincipal: Uint8Array,
  accountId: Uint8Array,
  principalText: Uint8Array,
): Uint8Array => {
  const parts = [publicKey, rawPrincipal, accountId, principalText];
  const data = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    data.set(part, offset);
    offset += part.length;
  }
  return data;
};

const hexToBytes = (hex: string): Uint8Array =>
  Uint8Array.from(Buffer.from(hex, "hex"));

// Captured from a real device GET_ADDR for 44'/223'/0'/0/0 (status word stripped).
const REAL_GET_ADDR_RESPONSE =
  "0468f65022f9f3ab8b5e7f6ef8d4c32c6d43d48af6befef190b223418e80a2552718e06a8bf00d29e00219d6f03dec3da8c18dfd96d754e9bae40e00204260d39b2df4ec3628b59d97cbfe0adbca4ac271aeae551965c51688f618b9ab02274dde7febd36b5960153eb5f6c22ea687b17240a5f57b43bc1fea59cf4426897961796a34356a6e367477646d6b667674776c347837716b3370666576717472763278666b676c6679756c69723571797867767165";

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

    it("should parse a real device response into publicKey, accountId and dashed principal", () => {
      // ACT
      const result = parse(hexToBytes(REAL_GET_ADDR_RESPONSE));
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.publicKey).toBe(
          "0468f65022f9f3ab8b5e7f6ef8d4c32c6d43d48af6befef190b223418e80a2552718e06a8bf00d29e00219d6f03dec3da8c18dfd96d754e9bae40e00204260d39b",
        );
        expect(result.data.accountId).toBe(
          "274dde7febd36b5960153eb5f6c22ea687b17240a5f57b43bc1fea59cf442689",
        );
        expect(result.data.principal).toBe(
          "yayj4-5jn6t-wdmkf-vtwl4-x7qk3-pfevq-trv2x-fkglf-yulir-5qyxg-vqe",
        );
      }
    });

    it("should group the textual principal into 5-char segments", () => {
      // ACT
      const result = parse(
        buildAddressResponseData(
          new Uint8Array(65).fill(0x02),
          new Uint8Array(29).fill(0x03),
          new Uint8Array(32).fill(0x0a),
          new TextEncoder().encode("2vxsxfae"),
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

    it("should not append a trailing dash when the principal length is a multiple of 5", () => {
      // ACT
      const result = parse(
        buildAddressResponseData(
          new Uint8Array(65).fill(0x02),
          new Uint8Array(29).fill(0x03),
          new Uint8Array(32).fill(0x0a),
          new TextEncoder().encode("abcdefghij"),
        ),
      );
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.principal).toBe("abcde-fghij");
      }
    });

    it("should reject a response whose raw principal is truncated", () => {
      // ARRANGE — publicKey present, but fewer than the fixed 29 principal bytes
      const result = parse(
        new Uint8Array([
          ...new Uint8Array(65).fill(0x02),
          ...new Uint8Array(10).fill(0x03),
        ]),
      );
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should reject a response too short to hold the account identifier", () => {
      // ARRANGE — publicKey + raw principal present, account id + text missing
      const result = parse(
        buildAddressResponseData(
          new Uint8Array(65).fill(0x02),
          new Uint8Array(29).fill(0x03),
          new Uint8Array(0),
          new Uint8Array(0),
        ),
      );
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should reject a response with an empty textual principal", () => {
      // ARRANGE — everything fixed-length present, but no principal text follows
      const result = parse(
        buildAddressResponseData(
          new Uint8Array(65).fill(0x02),
          new Uint8Array(29).fill(0x03),
          new Uint8Array(32).fill(0x0a),
          new Uint8Array(0),
        ),
      );
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
