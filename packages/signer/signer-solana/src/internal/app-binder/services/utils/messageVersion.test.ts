import { UNSTAKE_MESSAGE } from "@internal/app-binder/services/__test-utils__/ambiguousMessages";
import {
  SPEC_V1_MESSAGE,
  SPEC_V1_OFFSETS,
  withByte,
  withTrailingBytes,
} from "@internal/app-binder/services/__test-utils__/v1Fixtures";

import { checkMessageVersion, getMessageVersion } from "./messageVersion";

describe("getMessageVersion", () => {
  it.each([
    ["an empty message", [], "legacy"],
    ["a one-signer legacy message", [0x01, 0x00], "legacy"],
    ["the largest legacy first byte", [0x7f], "legacy"],
    ["a v0 message", [0x80, 0x01], 0],
    ["a v1 message", [0x81, 0x01], 1],
  ])("reads %s", (_, bytes, expected) => {
    expect(getMessageVersion(Uint8Array.from(bytes))).toBe(expected);
  });

  it.each([
    [0x82, 2],
    [0x83, 3],
    [0xff, 127],
  ])("reads first byte %i as unsupported version %i", (firstByte, version) => {
    expect(getMessageVersion(Uint8Array.from([firstByte, 0x01]))).toEqual({
      unsupported: version,
    });
  });
});

describe("checkMessageVersion", () => {
  const v0Message = Uint8Array.from([0x80, ...UNSTAKE_MESSAGE, 0]);
  const trailingByte = withTrailingBytes(SPEC_V1_MESSAGE, [0]);
  const lonePriorityFeeBit = withByte(
    SPEC_V1_MESSAGE,
    SPEC_V1_OFFSETS.configMask,
    0x0e,
  );

  it.each([
    ["a legacy message", UNSTAKE_MESSAGE],
    ["a v0 message", v0Message],
  ])("accepts %s, even on an app without v1", (_, message) => {
    expect(checkMessageVersion(message, false)).toBeNull();
  });

  it("accepts a valid v1 message on an app with v1", () => {
    expect(checkMessageVersion(SPEC_V1_MESSAGE, true)).toBeNull();
  });

  it("refuses a valid v1 message on an app without v1", () => {
    expect(checkMessageVersion(SPEC_V1_MESSAGE, false)).toMatchObject({
      _tag: "SolanaTransactionVersionNotSupportedError",
      version: 1,
      reason: "appVersion",
    });
  });

  it.each([
    [0x82, 2],
    [0xff, 127],
  ])(
    "refuses first byte %i as unknown version %i, whatever the app",
    (firstByte, version) => {
      const message = withByte(SPEC_V1_MESSAGE, 0, firstByte);

      for (const isV1Supported of [true, false]) {
        expect(checkMessageVersion(message, isV1Supported)).toMatchObject({
          _tag: "SolanaTransactionVersionNotSupportedError",
          version,
          reason: "unknownVersion",
        });
      }
    },
  );

  it.each([
    ["a trailing byte", trailingByte, "TRAILING_BYTES"],
    ["a lone priority-fee bit", lonePriorityFeeBit, "CONFIG_MASK"],
  ])(
    "refuses an invalid v1 message (%s) as invalid, whatever the app",
    (_, message, rule) => {
      for (const isV1Supported of [true, false]) {
        expect(checkMessageVersion(message, isV1Supported)).toMatchObject({
          _tag: "InvalidSolanaTransactionError",
          rule,
        });
      }
    },
  );
});
