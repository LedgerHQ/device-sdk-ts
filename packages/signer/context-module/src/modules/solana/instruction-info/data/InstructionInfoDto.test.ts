import { describe, expect, it } from "vitest";

import { calResetScopeCodec } from "./InstructionInfoDto";

const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

const witnessed = (
  overrides: {
    reset_account_index?: unknown;
    consumers?: unknown;
  } = {},
) => ({
  program_id: JUPITER,
  witness: {
    reset_account_index: 0,
    consumers: [{ discriminator: "96564774a75d0e68", account_index: 7 }],
    ...overrides,
  },
});

const consumer = (discriminator: unknown, account_index: unknown = 7) =>
  witnessed({ consumers: [{ discriminator, account_index }] });

describe("calResetScopeCodec", () => {
  describe("scope shapes", () => {
    it("accepts a plain scope, with or without discriminators", () => {
      expect(
        calResetScopeCodec
          .decode({ program_id: JUPITER, discriminators: ["0102", ""] })
          .isRight(),
      ).toBe(true);
      expect(calResetScopeCodec.decode({ program_id: JUPITER }).isRight()).toBe(
        true,
      );
    });

    it("accepts a witnessed scope", () => {
      expect(calResetScopeCodec.decode(witnessed()).isRight()).toBe(true);
    });

    // The codec checks each field; that a scope is plain or witnessed, never
    // both, is the mapper's rule (toResetScope), which drops such a view.
    it("leaves the plain-or-witnessed rule to the mapper", () => {
      expect(
        calResetScopeCodec
          .decode({ ...witnessed(), discriminators: ["01"] })
          .isRight(),
      ).toBe(true);
    });

    it.each([
      ["no program_id", { witness: witnessed().witness }],
      ["a non-string program_id", { program_id: 1 }],
      ["a witness without consumers", { program_id: JUPITER, witness: {} }],
      [
        "a consumer without a discriminator",
        witnessed({ consumers: [{ account_index: 7 }] }),
      ],
      [
        "a consumer without an account_index",
        witnessed({ consumers: [{ discriminator: "01" }] }),
      ],
      ["a non-object", "JUP6"],
    ])("rejects %s", (_, value) => {
      expect(calResetScopeCodec.decode(value).isLeft()).toBe(true);
    });
  });

  describe("discriminator prefixes", () => {
    it.each([
      ["0 bytes", ""],
      ["8 bytes", "96564774a75d0e68"],
      ["upper-case hex", "96564774A75D0E68"],
    ])("accepts %s", (_, discriminator) => {
      expect(calResetScopeCodec.decode(consumer(discriminator)).isRight()).toBe(
        true,
      );
      expect(
        calResetScopeCodec
          .decode({ program_id: JUPITER, discriminators: [discriminator] })
          .isRight(),
      ).toBe(true);
    });

    it.each([
      ["9 bytes", "96564774a75d0e6801"],
      ["an odd length", "965"],
      ["non-hex characters", "zz"],
      ["a 0x prefix", "0x9656"],
      ["a non-string", 0x96],
    ])("rejects %s", (_, discriminator) => {
      expect(calResetScopeCodec.decode(consumer(discriminator)).isLeft()).toBe(
        true,
      );
      expect(
        calResetScopeCodec
          .decode({ program_id: JUPITER, discriminators: [discriminator] })
          .isLeft(),
      ).toBe(true);
    });
  });

  describe("account indices", () => {
    it.each([0, 255])("accepts %s, a u8", (index) => {
      expect(
        calResetScopeCodec
          .decode(witnessed({ reset_account_index: index }))
          .isRight(),
      ).toBe(true);
      expect(calResetScopeCodec.decode(consumer("01", index)).isRight()).toBe(
        true,
      );
    });

    it.each([256, -1, 1.5, "7"])("rejects %s, not a u8", (index) => {
      expect(
        calResetScopeCodec
          .decode(witnessed({ reset_account_index: index }))
          .isLeft(),
      ).toBe(true);
      expect(calResetScopeCodec.decode(consumer("01", index)).isLeft()).toBe(
        true,
      );
    });
  });
});
