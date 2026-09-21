import { describe, expect, it } from "vitest";

import { checkAccountSchema } from "./accountSchema";
import { type RequirementAccount } from "./model";

function account(isWritable: boolean, isSigner: boolean): RequirementAccount {
  return { isWritable, isSigner };
}

const EITHER: { signer: "EITHER"; writable: "EITHER" } = {
  signer: "EITHER",
  writable: "EITHER",
};

describe("checkAccountSchema", () => {
  describe("count bounds", () => {
    it("passes when count == count_min == count_max", () => {
      const schema = {
        count_min: 2,
        count_max: 2,
        remaining_policy: EITHER,
        slots: [],
      };
      const accounts = [account(false, false), account(false, false)];
      expect(checkAccountSchema(schema, accounts)).toBeNull();
    });

    it("fails when count < count_min", () => {
      const schema = {
        count_min: 3,
        count_max: 5,
        remaining_policy: EITHER,
        slots: [],
      };
      const accounts = [account(false, false), account(false, false)];
      expect(checkAccountSchema(schema, accounts)).toMatch(/below COUNT_MIN/);
    });

    it("fails when count > count_max", () => {
      const schema = {
        count_min: 1,
        count_max: 2,
        remaining_policy: EITHER,
        slots: [],
      };
      const accounts = [
        account(false, false),
        account(false, false),
        account(false, false),
      ];
      expect(checkAccountSchema(schema, accounts)).toMatch(/above COUNT_MAX/);
    });

    it("passes when count > count_max but count_max is COUNT_UNBOUNDED (255)", () => {
      const schema = {
        count_min: 0,
        count_max: 255,
        remaining_policy: EITHER,
        slots: [],
      };
      const accounts = Array.from({ length: 300 }, () => account(false, false));
      expect(checkAccountSchema(schema, accounts)).toBeNull();
    });
  });

  describe("slot constraints — signer", () => {
    it("passes when REQUIRED and account is a signer", () => {
      const schema = {
        count_min: 1,
        count_max: 1,
        remaining_policy: EITHER,
        slots: [{ signer: "REQUIRED" as const, writable: "EITHER" as const }],
      };
      expect(checkAccountSchema(schema, [account(false, true)])).toBeNull();
    });

    it("fails when REQUIRED and account is not a signer", () => {
      const schema = {
        count_min: 1,
        count_max: 1,
        remaining_policy: EITHER,
        slots: [{ signer: "REQUIRED" as const, writable: "EITHER" as const }],
      };
      expect(checkAccountSchema(schema, [account(false, false)])).toMatch(
        /not a signer but the schema requires it/,
      );
    });

    it("passes when FORBIDDEN and account is not a signer", () => {
      const schema = {
        count_min: 1,
        count_max: 1,
        remaining_policy: EITHER,
        slots: [{ signer: "FORBIDDEN" as const, writable: "EITHER" as const }],
      };
      expect(checkAccountSchema(schema, [account(false, false)])).toBeNull();
    });

    it("fails when FORBIDDEN and account is a signer", () => {
      const schema = {
        count_min: 1,
        count_max: 1,
        remaining_policy: EITHER,
        slots: [{ signer: "FORBIDDEN" as const, writable: "EITHER" as const }],
      };
      expect(checkAccountSchema(schema, [account(false, true)])).toMatch(
        /is a signer but the schema forbids it/,
      );
    });
  });

  describe("slot constraints — writable", () => {
    it("passes when REQUIRED and account is writable", () => {
      const schema = {
        count_min: 1,
        count_max: 1,
        remaining_policy: EITHER,
        slots: [{ signer: "EITHER" as const, writable: "REQUIRED" as const }],
      };
      expect(checkAccountSchema(schema, [account(true, false)])).toBeNull();
    });

    it("fails when REQUIRED and account is not writable", () => {
      const schema = {
        count_min: 1,
        count_max: 1,
        remaining_policy: EITHER,
        slots: [{ signer: "EITHER" as const, writable: "REQUIRED" as const }],
      };
      expect(checkAccountSchema(schema, [account(false, false)])).toMatch(
        /not writable but the schema requires it/,
      );
    });

    it("passes when FORBIDDEN and account is not writable", () => {
      const schema = {
        count_min: 1,
        count_max: 1,
        remaining_policy: EITHER,
        slots: [{ signer: "EITHER" as const, writable: "FORBIDDEN" as const }],
      };
      expect(checkAccountSchema(schema, [account(false, false)])).toBeNull();
    });

    it("fails when FORBIDDEN and account is writable", () => {
      const schema = {
        count_min: 1,
        count_max: 1,
        remaining_policy: EITHER,
        slots: [{ signer: "EITHER" as const, writable: "FORBIDDEN" as const }],
      };
      expect(checkAccountSchema(schema, [account(true, false)])).toMatch(
        /is writable but the schema forbids it/,
      );
    });
  });

  describe("remaining_policy (accounts beyond slots array)", () => {
    it("applies remaining_policy to slots beyond the slots array", () => {
      const schema = {
        count_min: 3,
        count_max: 255,
        remaining_policy: {
          signer: "FORBIDDEN" as const,
          writable: "EITHER" as const,
        },
        slots: [EITHER, EITHER],
      };
      const accounts = [
        account(false, false),
        account(false, false),
        account(false, true), // slot 2: no explicit slot → remaining_policy with FORBIDDEN signer
      ];
      expect(checkAccountSchema(schema, accounts)).toMatch(
        /is a signer but the schema forbids it/,
      );
    });

    it("passes when remaining_policy matches remaining accounts", () => {
      const schema = {
        count_min: 3,
        count_max: 255,
        remaining_policy: {
          signer: "FORBIDDEN" as const,
          writable: "EITHER" as const,
        },
        slots: [EITHER, EITHER],
      };
      const accounts = [
        account(false, false),
        account(false, false),
        account(true, false), // not a signer — passes FORBIDDEN signer
      ];
      expect(checkAccountSchema(schema, accounts)).toBeNull();
    });
  });

  describe("error reports correct slot index", () => {
    it("includes the failing slot index in the message", () => {
      const schema = {
        count_min: 3,
        count_max: 3,
        remaining_policy: EITHER,
        slots: [
          EITHER,
          { signer: "REQUIRED" as const, writable: "EITHER" as const },
          EITHER,
        ],
      };
      const accounts = [
        account(false, false),
        account(false, false), // slot 1: needs to be signer
        account(false, false),
      ];
      const result = checkAccountSchema(schema, accounts);
      expect(result).toContain("slot 1");
    });
  });
});
