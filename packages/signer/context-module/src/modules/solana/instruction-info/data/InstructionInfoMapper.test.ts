import { describe, expect, it } from "vitest";

import { type CalInstructionDescriptorDto } from "./InstructionInfoDto";
import {
  toAccountResets,
  toDisplayFields,
  toInstructionInfoPayload,
  toProgramEnumVariants,
  toValueFlowPorts,
} from "./InstructionInfoMapper";

const PROGRAM = "11111111111111111111111111111111";

function makeDescriptor(
  overrides: Partial<CalInstructionDescriptorDto> = {},
): CalInstructionDescriptorDto {
  return {
    discriminator_hex: "00000000",
    instruction_name: "createAccount",
    descriptor: {
      data: "0001sys_data",
      signatures: { prod: "prodsig", test: "testsig" },
    },
    ...overrides,
  };
}

describe("InstructionInfoMapper", () => {
  describe("toValueFlowPorts", () => {
    it("returns an empty list for undefined input", () => {
      expect(toValueFlowPorts()).toEqual([]);
    });

    it("picks only the decoded fields, dropping the signed-TLV descriptor", () => {
      expect(
        toValueFlowPorts([
          {
            descriptor: "vfp1",
            account_indices: [0, 1],
            optional_account_strategy: "OMITTED",
            token_value: { kind: "NATIVE" },
          },
        ]),
      ).toEqual([
        {
          account_indices: [0, 1],
          optional_account_strategy: "OMITTED",
          token_value: { kind: "NATIVE" },
        },
      ]);
    });

    it("leaves the absent optional strategy as undefined", () => {
      expect(
        toValueFlowPorts([
          {
            descriptor: "vfp1",
            account_indices: [0],
            token_value: { kind: "NATIVE" },
          },
        ]),
      ).toEqual([
        {
          account_indices: [0],
          optional_account_strategy: undefined,
          token_value: { kind: "NATIVE" },
        },
      ]);
    });
  });

  describe("toAccountResets", () => {
    it("returns an empty list for undefined input", () => {
      expect(toAccountResets()).toEqual([]);
    });

    it("maps the decoded fields, dropping the signed-TLV descriptor", () => {
      expect(
        toAccountResets([
          {
            descriptor: "ar1",
            account_index: 2,
            require_pre_balance_zero: true,
          },
        ]),
      ).toEqual([{ account_index: 2, require_pre_balance_zero: true }]);
    });

    it("drops entries missing account_index instead of defaulting to slot 0", () => {
      expect(
        toAccountResets([
          { descriptor: "ar0", account_index: 0 },
          { descriptor: "arBad" },
          { descriptor: "ar1", account_index: 1 },
        ]),
      ).toEqual([
        { account_index: 0, require_pre_balance_zero: undefined },
        { account_index: 1, require_pre_balance_zero: undefined },
      ]);
    });
  });

  describe("toDisplayFields", () => {
    it("returns an empty list for undefined input", () => {
      expect(toDisplayFields()).toEqual([]);
    });

    it("picks name and param, dropping the signed-TLV descriptor", () => {
      expect(
        toDisplayFields([
          {
            descriptor: "df1",
            name: "New Account",
            param: {
              type: "ACCOUNT",
              value: { source: "ACCOUNT_PATH", account_index: 1 },
            },
          },
        ]),
      ).toEqual([
        {
          name: "New Account",
          param: {
            type: "ACCOUNT",
            value: { source: "ACCOUNT_PATH", account_index: 1 },
          },
        },
      ]);
    });

    it("falls back to an empty-type param when param is absent", () => {
      expect(toDisplayFields([{ descriptor: "df1" }])).toEqual([
        { name: undefined, param: { type: "" } },
      ]);
    });
  });

  describe("toInstructionInfoPayload", () => {
    it("surfaces CAL's decoded JSON (type pool, mint assoc, ports, resets, fields) and ordered substructures", () => {
      const dto = makeDescriptor({
        idl_descriptor: {
          root_type: 3,
          type_pool: [
            { index: 0, kind: "STRUCT", refs: [1] },
            { index: 1, kind: "U64" },
          ],
        },
        mint_association: { account_index: 1, mint_index: 3 },
        display_fields: [
          {
            descriptor: "df1",
            name: "New Account",
            param: {
              type: "ACCOUNT",
              value: { source: "ACCOUNT_PATH", account_index: 1 },
            },
          },
        ],
        value_flow_ports: [
          {
            descriptor: "vfp1",
            account_indices: [0],
            token_value: { kind: "NATIVE" },
          },
        ],
        hide_rules: [{ descriptor: "hr1" }],
        account_resets: [
          {
            descriptor: "ar1",
            account_index: 1,
            require_pre_balance_zero: true,
          },
        ],
      });

      const payload = toInstructionInfoPayload(
        PROGRAM,
        "00000000",
        dto,
        "prod",
      ).unsafeCoerce();

      expect(payload).toMatchObject({
        programId: PROGRAM,
        discriminator: "00000000",
        instructionInfo: { data: "0001sys_data", signature: "prodsig" },
        idlDescriptor: {
          rootType: 3,
          typePool: [
            { index: 0, kind: "STRUCT", refs: [1] },
            { index: 1, kind: "U64" },
          ],
        },
        mintAssociations: [{ account_index: 1, mint_index: 3 }],
        valueFlowPorts: [
          {
            account_indices: [0],
            optional_account_strategy: undefined,
            token_value: { kind: "NATIVE" },
          },
        ],
        accountResets: [{ account_index: 1, require_pre_balance_zero: true }],
        displayFields: [
          {
            name: "New Account",
            param: {
              type: "ACCOUNT",
              value: { source: "ACCOUNT_PATH", account_index: 1 },
            },
          },
        ],
      });
      // Substructures carry the signed TLVs for the device, in order.
      expect(payload.substructures).toEqual([
        { kind: 0x00, data: "df1" },
        { kind: 0x01, data: "vfp1" },
        { kind: 0x02, data: "hr1" },
        { kind: 0x03, data: "ar1" },
      ]);
    });

    it("defaults idlDescriptor when CAL omits it", () => {
      const payload = toInstructionInfoPayload(
        PROGRAM,
        "00000000",
        makeDescriptor(),
        "prod",
      ).unsafeCoerce();
      expect(payload.idlDescriptor).toEqual({ typePool: [], rootType: 0 });
      expect(payload.mintAssociations).toEqual([]);
    });

    it("bundles CAL enum_variants into the payload with the mode signature", () => {
      const dto = makeDescriptor({
        enum_variants: {
          swap: {
            "46": {
              variant_name: "raydiumCP",
              descriptor: {
                data: "01_raydium_tlv",
                signatures: { prod: "prodsig_v46", test: "testsig_v46" },
              },
            },
          },
        },
      });
      const payload = toInstructionInfoPayload(
        PROGRAM,
        "00000000",
        dto,
        "prod",
      ).unsafeCoerce();
      expect(payload.enumVariants).toEqual([
        {
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "01_raydium_tlv", signature: "prodsig_v46" },
        },
      ]);
    });

    it("skips enum_variants keyed by a non-u16 index instead of leaking NaN", () => {
      const dto = makeDescriptor({
        enum_variants: {
          swap: {
            "46": {
              variant_name: "raydiumCP",
              descriptor: {
                data: "01_raydium_tlv",
                signatures: { prod: "prodsig_v46", test: "testsig_v46" },
              },
            },
            "7abc": {
              variant_name: "junk",
              descriptor: {
                data: "junk_tlv",
                signatures: { prod: "x", test: "x" },
              },
            },
            "70000": {
              variant_name: "overflow",
              descriptor: {
                data: "overflow_tlv",
                signatures: { prod: "x", test: "x" },
              },
            },
          },
        },
      });
      const payload = toInstructionInfoPayload(
        PROGRAM,
        "00000000",
        dto,
        "prod",
      ).unsafeCoerce();
      expect(payload.enumVariants).toEqual([
        {
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "01_raydium_tlv", signature: "prodsig_v46" },
        },
      ]);
    });

    it("selects the signature for the configured mode", () => {
      const payload = toInstructionInfoPayload(
        PROGRAM,
        "00000000",
        makeDescriptor(),
        "test",
      ).unsafeCoerce();
      expect(payload.instructionInfo.signature).toBe("testsig");
    });

    it("returns Left when the configured mode signature is missing", () => {
      const dto = makeDescriptor();
      delete (dto.descriptor.signatures as { test?: string }).test;
      const result = toInstructionInfoPayload(PROGRAM, "00000000", dto, "test");
      expect(result.isLeft()).toBe(true);
      expect(result.swap().unsafeCoerce().message).toMatch(
        /missing 'test' signature/,
      );
    });
  });

  describe("toProgramEnumVariants", () => {
    it("flattens enum variants across all descriptors, dropping malformed keys", () => {
      const descriptors: Record<string, CalInstructionDescriptorDto> = {
        "00000000": makeDescriptor({
          enum_variants: {
            swap: {
              "46": {
                variant_name: "raydiumCP",
                descriptor: {
                  data: "01_raydium_tlv",
                  signatures: { prod: "prodsig_v46", test: "testsig_v46" },
                },
              },
              bad: {
                variant_name: "junk",
                descriptor: {
                  data: "junk_tlv",
                  signatures: { prod: "x", test: "x" },
                },
              },
            },
          },
        }),
        "00000001": makeDescriptor({
          enum_variants: {
            route: {
              "12": {
                variant_name: "orca",
                descriptor: {
                  data: "02_orca_tlv",
                  signatures: { prod: "prodsig_v12", test: "testsig_v12" },
                },
              },
            },
          },
        }),
      };
      expect(toProgramEnumVariants(descriptors, "prod")).toEqual([
        {
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "01_raydium_tlv", signature: "prodsig_v46" },
        },
        {
          enumId: "route",
          variantIndex: 12,
          descriptor: { data: "02_orca_tlv", signature: "prodsig_v12" },
        },
      ]);
    });

    it("leaves the signature empty when CAL has none for the configured mode", () => {
      const dto = makeDescriptor({
        enum_variants: {
          swap: {
            "46": {
              variant_name: "raydiumCP",
              descriptor: {
                data: "01_raydium_tlv",
                signatures: { prod: "prodsig_v46" },
              },
            },
          },
        },
      });
      expect(toProgramEnumVariants({ "00000000": dto }, "test")).toEqual([
        {
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "01_raydium_tlv", signature: "" },
        },
      ]);
    });
  });
});
