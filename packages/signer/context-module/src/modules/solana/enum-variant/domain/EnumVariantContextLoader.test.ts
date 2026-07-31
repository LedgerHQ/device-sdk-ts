/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import {
  type InstructionInfoDataSource,
  type InstructionInfoResult,
} from "@/modules/solana/instruction-info/data/InstructionInfoDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { EnumVariantContextLoader } from "./EnumVariantContextLoader";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

const mockCertificate = {
  keyUsageNumber: 8,
  payload: new Uint8Array([0x42]),
};

const mockConfig = {
  cal: {
    url: "https://global.api.prd.ledger.com/cal/v1",
    mode: "prod",
    branch: "main",
  },
} as ContextModuleServiceConfig;

const JUPITER_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const OTHER_PROGRAM = "OtherProgram111111111111111111111111111111";

// The data source flattens enum variants into core models, with the signature
// already picked for the configured mode.
function makeJupiterWithVariants(): InstructionInfoResult {
  return {
    programId: JUPITER_PROGRAM,
    descriptors: {},
    enumVariants: [
      {
        enumId: "swap",
        variantIndex: 46,
        descriptor: { data: "01_raydium_tlv", signature: "prodsig_v46" },
      },
      {
        enumId: "swap",
        variantIndex: 12,
        descriptor: { data: "01_orca_tlv", signature: "prodsig_v12" },
      },
    ],
  };
}

describe("EnumVariantContextLoader", () => {
  let dataSource: InstructionInfoDataSource;
  let certificateLoader: PkiCertificateLoader;

  beforeEach(() => {
    vi.restoreAllMocks();
    dataSource = {
      getInstructionInfo: vi.fn(),
    };
    certificateLoader = {
      loadCertificate: vi.fn().mockResolvedValue(mockCertificate),
    };
  });

  const makeLoader = (config = mockConfig) =>
    new EnumVariantContextLoader(
      dataSource,
      config,
      certificateLoader,
      mockLoggerFactory,
    );

  describe("canHandle", () => {
    it("returns true when SOLANA_ENUM_VARIANT is requested and selections are valid", () => {
      expect(
        makeLoader().canHandle(
          {
            deviceModelId: DeviceModelId.NANO_X,
            selections: [
              {
                programId: JUPITER_PROGRAM,
                enumId: "swap",
                variantIndex: 46,
              },
            ],
          },
          [ClearSignContextType.SOLANA_ENUM_VARIANT],
        ),
      ).toBe(true);
    });

    it("returns false when SOLANA_ENUM_VARIANT is not requested", () => {
      expect(
        makeLoader().canHandle(
          {
            deviceModelId: DeviceModelId.NANO_X,
            selections: [
              { programId: JUPITER_PROGRAM, enumId: "swap", variantIndex: 46 },
            ],
          },
          [ClearSignContextType.SOLANA_INSTRUCTION_INFO],
        ),
      ).toBe(false);
    });

    it.each([-1, 65536, 1.5, "46", null])(
      "rejects non-u16 variantIndex: %s",
      (badIndex) => {
        const loader = makeLoader();
        expect(
          loader.canHandle(
            {
              deviceModelId: DeviceModelId.NANO_X,
              selections: [
                {
                  programId: JUPITER_PROGRAM,
                  enumId: "swap",
                  variantIndex: badIndex,
                },
              ],
            } as any,
            [ClearSignContextType.SOLANA_ENUM_VARIANT],
          ),
        ).toBe(false);
      },
    );

    it("rejects empty programId / enumId / selections", () => {
      const loader = makeLoader();
      const types = [ClearSignContextType.SOLANA_ENUM_VARIANT];
      expect(loader.canHandle({ selections: [] } as any, types)).toBe(false);
      expect(
        loader.canHandle(
          {
            selections: [{ programId: "", enumId: "swap", variantIndex: 1 }],
          } as any,
          types,
        ),
      ).toBe(false);
      expect(
        loader.canHandle(
          {
            selections: [
              { programId: JUPITER_PROGRAM, enumId: "", variantIndex: 1 },
            ],
          } as any,
          types,
        ),
      ).toBe(false);
    });
  });

  describe("load", () => {
    it("emits one SOLANA_ENUM_VARIANT per selection with certificate", async () => {
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(makeJupiterWithVariants()),
      );

      const result = await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        selections: [
          { programId: JUPITER_PROGRAM, enumId: "swap", variantIndex: 46 },
          { programId: JUPITER_PROGRAM, enumId: "swap", variantIndex: 12 },
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        type: ClearSignContextType.SOLANA_ENUM_VARIANT,
        payload: {
          programId: JUPITER_PROGRAM,
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "01_raydium_tlv", signature: "prodsig_v46" },
        },
        certificate: mockCertificate,
      });
      expect(result[1]).toMatchObject({
        payload: {
          variantIndex: 12,
          descriptor: { data: "01_orca_tlv", signature: "prodsig_v12" },
        },
      });
    });

    it("dedups CAL fetches across selections that share a programId", async () => {
      const spy = vi
        .spyOn(dataSource, "getInstructionInfo")
        .mockResolvedValue(Right(makeJupiterWithVariants()));

      await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        selections: [
          { programId: JUPITER_PROGRAM, enumId: "swap", variantIndex: 46 },
          { programId: JUPITER_PROGRAM, enumId: "swap", variantIndex: 12 },
        ],
      });

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("resolves a variant index > 255 (u16, disc_kind U16 enums)", async () => {
      const result: InstructionInfoResult = {
        programId: JUPITER_PROGRAM,
        descriptors: {},
        enumVariants: [
          {
            enumId: "swap",
            variantIndex: 300,
            descriptor: { data: "01_big_tlv", signature: "prodsig_v300" },
          },
        ],
      };
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(result),
      );

      const out = await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        selections: [
          { programId: JUPITER_PROGRAM, enumId: "swap", variantIndex: 300 },
        ],
      });

      expect(out).toHaveLength(1);
      expect(out[0]?.type).toBe(ClearSignContextType.SOLANA_ENUM_VARIANT);
      expect((out[0] as any).payload).toMatchObject({
        variantIndex: 300,
        descriptor: { data: "01_big_tlv", signature: "prodsig_v300" },
      });
    });

    it("emits ERROR when CAL has no matching variant for a selection", async () => {
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(makeJupiterWithVariants()),
      );

      const result = await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        selections: [
          { programId: JUPITER_PROGRAM, enumId: "swap", variantIndex: 99 },
        ],
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe(ClearSignContextType.ERROR);
      expect((result[0] as any).error.message).toMatch(/no enum variant/);
    });

    it("emits ERROR when CAL fetch fails", async () => {
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Left(new Error("upstream-500")),
      );

      const result = await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        selections: [
          { programId: OTHER_PROGRAM, enumId: "x", variantIndex: 0 },
        ],
      });

      expect(result[0]?.type).toBe(ClearSignContextType.ERROR);
      expect((result[0] as any).error.message).toBe("upstream-500");
    });

    it("emits ERROR when configured signature mode is missing", async () => {
      // The mapper leaves the signature empty when CAL has none for the mode.
      const result: InstructionInfoResult = {
        programId: JUPITER_PROGRAM,
        descriptors: {},
        enumVariants: [
          {
            enumId: "swap",
            variantIndex: 46,
            descriptor: { data: "01_raydium_tlv", signature: "" },
          },
        ],
      };
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(result),
      );

      const loader = makeLoader({
        ...mockConfig,
        cal: { ...mockConfig.cal, mode: "test" },
      } as any);

      const out = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        selections: [
          { programId: JUPITER_PROGRAM, enumId: "swap", variantIndex: 46 },
        ],
      });

      expect(out[0]?.type).toBe(ClearSignContextType.ERROR);
      expect((out[0] as any).error.message).toMatch(/missing 'test' signature/);
    });

    it("degrades every selection to ERROR when certificate loading fails", async () => {
      vi.spyOn(certificateLoader, "loadCertificate").mockRejectedValue(
        new Error("pki-down"),
      );
      // Data fetches run in parallel with cert load; resolve so awaits settle.
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(makeJupiterWithVariants()),
      );

      const out = await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        selections: [
          { programId: JUPITER_PROGRAM, enumId: "swap", variantIndex: 46 },
          { programId: JUPITER_PROGRAM, enumId: "swap", variantIndex: 12 },
        ],
      });

      expect(out).toHaveLength(2);
      expect(out.every((c) => c.type === ClearSignContextType.ERROR)).toBe(
        true,
      );
    });

    it("falls back to default network when input.network is empty / missing", async () => {
      const spy = vi
        .spyOn(dataSource, "getInstructionInfo")
        .mockResolvedValue(Right(makeJupiterWithVariants()));

      await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        selections: [
          { programId: JUPITER_PROGRAM, enumId: "swap", variantIndex: 46 },
        ],
        network: "",
      });

      expect(spy).toHaveBeenCalledWith({
        programId: JUPITER_PROGRAM,
        network: "solana-mainnet",
      });
    });
  });
});
