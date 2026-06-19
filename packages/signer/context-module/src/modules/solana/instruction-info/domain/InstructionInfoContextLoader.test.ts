/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

import { InstructionInfoContextLoader } from "./InstructionInfoContextLoader";

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
    url: "https://crypto-assets-service.api.ledger.com/v1",
    mode: "prod",
    branch: "main",
  },
} as ContextModuleServiceConfig;

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const JUPITER_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

function makeSystemCreateAccountResult(): InstructionInfoResult {
  return {
    programId: SYSTEM_PROGRAM,
    descriptors: {
      "00000000": {
        type: "instruction",
        instruction_info: {
          version: 1,
          program_id: SYSTEM_PROGRAM,
          discriminator: "00000000",
          hash: "feedface",
          descriptor: {
            data: "0001sys_data",
            signatures: { prod: "prodsig_sys", test: "testsig_sys" },
          },
        },
        display_fields: [{ descriptor: "df1" }, { descriptor: "df2" }],
        value_flow_ports: [{ descriptor: "vfp1" }],
        hide_rules: [],
        account_resets: [],
      },
    },
  };
}

function makeJupiterRouteResult(): InstructionInfoResult {
  return {
    programId: JUPITER_PROGRAM,
    descriptors: {
      e517cb977ae3ad2a: {
        type: "instruction",
        instruction_info: {
          version: 1,
          program_id: JUPITER_PROGRAM,
          discriminator: "e517cb977ae3ad2a",
          hash: "deadbeef",
          descriptor: {
            data: "0001jup_data",
            signatures: { prod: "prodsig_jup", test: "testsig_jup" },
          },
        },
        display_fields: [],
        value_flow_ports: [{ descriptor: "vfp_in" }, { descriptor: "vfp_out" }],
        hide_rules: [],
        account_resets: [],
      },
    },
  };
}

describe("InstructionInfoContextLoader", () => {
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
    new InstructionInfoContextLoader(
      dataSource,
      config,
      certificateLoader,
      mockLoggerFactory,
    );

  describe("canHandle", () => {
    it("returns true when SOLANA_INSTRUCTION_INFO is requested and instructions are present", () => {
      expect(
        makeLoader().canHandle(
          {
            deviceModelId: DeviceModelId.NANO_X,
            instructions: [{ programId: SYSTEM_PROGRAM }],
          },
          [ClearSignContextType.SOLANA_INSTRUCTION_INFO],
        ),
      ).toBe(true);
    });

    it("returns false when SOLANA_INSTRUCTION_INFO is not requested", () => {
      expect(
        makeLoader().canHandle(
          {
            deviceModelId: DeviceModelId.NANO_X,
            instructions: [{ programId: SYSTEM_PROGRAM }],
          },
          [ClearSignContextType.SOLANA_TOKEN],
        ),
      ).toBe(false);
    });

    it("returns false on missing / empty / malformed instructions", () => {
      const loader = makeLoader();
      const types = [ClearSignContextType.SOLANA_INSTRUCTION_INFO];
      expect(loader.canHandle({} as any, types)).toBe(false);
      expect(loader.canHandle({ instructions: [] } as any, types)).toBe(false);
      expect(
        loader.canHandle({ instructions: [{ programId: "" }] } as any, types),
      ).toBe(false);
      expect(loader.canHandle(null, types)).toBe(false);
      expect(loader.canHandle("string", types)).toBe(false);
    });
  });

  describe("load", () => {
    it("fans out one CAL call per distinct programId in parallel", async () => {
      const loader = makeLoader();
      const spy = vi
        .spyOn(dataSource, "getInstructionInfo")
        .mockImplementation(async ({ programId }) => {
          if (programId === SYSTEM_PROGRAM)
            return Right(makeSystemCreateAccountResult());
          if (programId === JUPITER_PROGRAM)
            return Right(makeJupiterRouteResult());
          return Left(new Error("unknown program"));
        });

      const result = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        instructions: [
          { programId: SYSTEM_PROGRAM, discriminator: "00000000" },
          { programId: SYSTEM_PROGRAM, discriminator: "00000000" }, // dup
          { programId: JUPITER_PROGRAM, discriminator: "e517cb977ae3ad2a" },
        ],
        network: "solana-mainnet",
      });

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith({
        programId: SYSTEM_PROGRAM,
        network: "solana-mainnet",
      });
      expect(spy).toHaveBeenCalledWith({
        programId: JUPITER_PROGRAM,
        network: "solana-mainnet",
      });

      // Only INSTRUCTION_INFO contexts now — enum variants moved to
      // EnumVariantContextLoader.
      expect(
        result.every(
          (c) =>
            c.type === ClearSignContextType.SOLANA_INSTRUCTION_INFO ||
            c.type === ClearSignContextType.ERROR,
        ),
      ).toBe(true);
      expect(
        result.filter(
          (c) => c.type === ClearSignContextType.SOLANA_INSTRUCTION_INFO,
        ),
      ).toHaveLength(2);
    });

    it("emits one SOLANA_INSTRUCTION_INFO per matching (programId, discriminator) with substructures and certificate bundled", async () => {
      const loader = makeLoader();
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(makeSystemCreateAccountResult()),
      );

      const result = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        instructions: [
          { programId: SYSTEM_PROGRAM, discriminator: "00000000" },
        ],
      });

      const infoCtx = result.find(
        (c) => c.type === ClearSignContextType.SOLANA_INSTRUCTION_INFO,
      );
      expect(infoCtx).toBeDefined();
      expect(infoCtx).toMatchObject({
        type: ClearSignContextType.SOLANA_INSTRUCTION_INFO,
        certificate: mockCertificate,
      });
      expect((infoCtx as any).payload).toMatchObject({
        programId: SYSTEM_PROGRAM,
        discriminator: "00000000",
        instructionInfo: { data: "0001sys_data", signature: "prodsig_sys" },
        substructures: [
          { kind: 0x00, data: "df1" },
          { kind: 0x00, data: "df2" },
          { kind: 0x01, data: "vfp1" },
        ],
      });
    });

    it("does NOT emit SOLANA_ENUM_VARIANT contexts (those come from EnumVariantContextLoader)", async () => {
      const loader = makeLoader();
      const jupiter = makeJupiterRouteResult();
      // Stuff an enum_variants entry into the descriptor to confirm it's ignored.
      const descriptor = jupiter.descriptors["e517cb977ae3ad2a"];
      if (!descriptor) throw new Error("fixture: descriptor must exist");
      descriptor.enum_variants = {
        swap: {
          "46": {
            variant_name: "raydiumCP",
            data: "01_raydium_tlv",
            signatures: { prod: "prodsig_v46", test: "testsig_v46" },
          },
        },
      };
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(jupiter),
      );

      const result = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        instructions: [
          { programId: JUPITER_PROGRAM, discriminator: "e517cb977ae3ad2a" },
        ],
      });

      expect(
        result.filter(
          (c) => c.type === ClearSignContextType.SOLANA_ENUM_VARIANT,
        ),
      ).toHaveLength(0);
    });

    it("bundles CAL enum_variants into the SOLANA_INSTRUCTION_INFO payload (host decode cache)", async () => {
      const loader = makeLoader();
      const jupiter = makeJupiterRouteResult();
      const descriptor = jupiter.descriptors["e517cb977ae3ad2a"];
      if (!descriptor) throw new Error("fixture: descriptor must exist");
      descriptor.enum_variants = {
        swap: {
          "46": {
            variant_name: "raydiumCP",
            data: "01_raydium_tlv",
            signatures: { prod: "prodsig_v46", test: "testsig_v46" },
          },
        },
      };
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(jupiter),
      );

      const result = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        instructions: [
          { programId: JUPITER_PROGRAM, discriminator: "e517cb977ae3ad2a" },
        ],
      });

      const infoCtx = result.find(
        (c) => c.type === ClearSignContextType.SOLANA_INSTRUCTION_INFO,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((infoCtx as any).payload.enumVariants).toEqual([
        {
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "01_raydium_tlv", signature: "prodsig_v46" },
        },
      ]);
    });

    it("skips enum_variants keyed by a non-u16 index instead of leaking NaN", async () => {
      const loader = makeLoader();
      const jupiter = makeJupiterRouteResult();
      const descriptor = jupiter.descriptors["e517cb977ae3ad2a"];
      if (!descriptor) throw new Error("fixture: descriptor must exist");
      descriptor.enum_variants = {
        swap: {
          "46": {
            variant_name: "raydiumCP",
            data: "01_raydium_tlv",
            signatures: { prod: "prodsig_v46", test: "testsig_v46" },
          },
          // malformed keys CAL must never produce, but the codec guards anyway
          "7abc": {
            variant_name: "junk",
            data: "junk_tlv",
            signatures: { prod: "x", test: "x" },
          },
          "70000": {
            variant_name: "overflow",
            data: "overflow_tlv",
            signatures: { prod: "x", test: "x" },
          },
        },
      };
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(jupiter),
      );

      const result = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        instructions: [
          { programId: JUPITER_PROGRAM, discriminator: "e517cb977ae3ad2a" },
        ],
      });

      const infoCtx = result.find(
        (c) => c.type === ClearSignContextType.SOLANA_INSTRUCTION_INFO,
      );
      // only the valid u16 key survives
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((infoCtx as any).payload.enumVariants).toEqual([
        {
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "01_raydium_tlv", signature: "prodsig_v46" },
        },
      ]);
    });

    it("filters descriptors by requested discriminator", async () => {
      const loader = makeLoader();
      const result: InstructionInfoResult = {
        programId: SYSTEM_PROGRAM,
        descriptors: {
          ...makeSystemCreateAccountResult().descriptors,
          "00000001": {
            type: "instruction",
            instruction_info: {
              version: 1,
              program_id: SYSTEM_PROGRAM,
              discriminator: "00000001",
              hash: "feedface2",
              descriptor: {
                data: "0001other",
                signatures: { prod: "p", test: "t" },
              },
            },
            display_fields: [{ descriptor: "shouldnotappear" }],
          },
        },
      };
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(result),
      );

      const out = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        instructions: [
          { programId: SYSTEM_PROGRAM, discriminator: "00000000" },
        ],
      });

      const infos = out.filter(
        (c) => c.type === ClearSignContextType.SOLANA_INSTRUCTION_INFO,
      );
      expect(infos).toHaveLength(1);
      expect((infos[0] as any).payload.discriminator).toBe("00000000");
    });

    it("emits one ERROR context when CAL fails for a program but keeps processing the others", async () => {
      const loader = makeLoader();
      vi.spyOn(dataSource, "getInstructionInfo").mockImplementation(
        async ({ programId }) => {
          if (programId === SYSTEM_PROGRAM)
            return Right(makeSystemCreateAccountResult());
          return Left(new Error("upstream-500"));
        },
      );

      const out = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        instructions: [
          { programId: SYSTEM_PROGRAM, discriminator: "00000000" },
          { programId: JUPITER_PROGRAM, discriminator: "e517cb977ae3ad2a" },
        ],
      });

      const errors = out.filter((c) => c.type === ClearSignContextType.ERROR);
      const infos = out.filter(
        (c) => c.type === ClearSignContextType.SOLANA_INSTRUCTION_INFO,
      );
      expect(errors).toHaveLength(1);
      expect(infos).toHaveLength(1);
    });

    it("emits ERROR (not empty signature) when configured CAL mode signature is missing", async () => {
      const loader = new InstructionInfoContextLoader(
        dataSource,
        { ...mockConfig, cal: { ...mockConfig.cal, mode: "test" } } as any,
        certificateLoader,
        mockLoggerFactory,
      );
      // Only prod signature in CAL response; loader is configured for test.
      const result = makeJupiterRouteResult();
      const descriptor = result.descriptors["e517cb977ae3ad2a"];
      if (!descriptor) throw new Error("fixture: descriptor must exist");
      delete (descriptor.instruction_info.descriptor.signatures as any).test;
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(result),
      );

      const out = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        instructions: [
          { programId: JUPITER_PROGRAM, discriminator: "e517cb977ae3ad2a" },
        ],
      });

      expect(out).toHaveLength(1);
      expect(out[0]?.type).toBe(ClearSignContextType.ERROR);
      expect((out[0] as any).error.message).toMatch(/missing 'test' signature/);
    });

    it("degrades every program to ERROR when certificate loading fails", async () => {
      vi.spyOn(certificateLoader, "loadCertificate").mockRejectedValue(
        new Error("pki-down"),
      );
      // Data fetches happen in parallel with the cert load, so they may run
      // before the cert rejection settles. Resolve them so allSettled-like
      // logic doesn't dangle.
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(makeSystemCreateAccountResult()),
      );
      const loader = makeLoader();

      const out = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        instructions: [
          { programId: SYSTEM_PROGRAM },
          { programId: JUPITER_PROGRAM },
        ],
      });

      expect(out).toHaveLength(2);
      expect(out.every((c) => c.type === ClearSignContextType.ERROR)).toBe(
        true,
      );
    });

    it("degrades every program to ERROR when the certificate resolves undefined", async () => {
      vi.spyOn(certificateLoader, "loadCertificate").mockResolvedValue(
        undefined,
      );
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(makeSystemCreateAccountResult()),
      );
      const loader = makeLoader();

      const out = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        instructions: [
          { programId: SYSTEM_PROGRAM },
          { programId: JUPITER_PROGRAM },
        ],
      });

      expect(out).toHaveLength(2);
      expect(out.every((c) => c.type === ClearSignContextType.ERROR)).toBe(
        true,
      );
      expect((out[0] as any).error.message).toMatch(/certificate is missing/);
    });

    it("selects signatures based on config.cal.mode (test)", async () => {
      const loader = new InstructionInfoContextLoader(
        dataSource,
        { ...mockConfig, cal: { ...mockConfig.cal, mode: "test" } } as any,
        certificateLoader,
        mockLoggerFactory,
      );
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(makeJupiterRouteResult()),
      );

      const out = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        instructions: [
          { programId: JUPITER_PROGRAM, discriminator: "e517cb977ae3ad2a" },
        ],
      });

      const info = out.find(
        (c) => c.type === ClearSignContextType.SOLANA_INSTRUCTION_INFO,
      );
      expect((info as any).payload.instructionInfo.signature).toBe(
        "testsig_jup",
      );
    });

    it("falls back to default network when input.network is omitted or empty string", async () => {
      const loader = makeLoader();
      const spy = vi
        .spyOn(dataSource, "getInstructionInfo")
        .mockResolvedValue(Right(makeSystemCreateAccountResult()));

      await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        instructions: [{ programId: SYSTEM_PROGRAM }],
      });
      expect(spy).toHaveBeenLastCalledWith({
        programId: SYSTEM_PROGRAM,
        network: "solana-mainnet",
      });

      await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        instructions: [{ programId: SYSTEM_PROGRAM }],
        network: "",
      });
      expect(spy).toHaveBeenLastCalledWith({
        programId: SYSTEM_PROGRAM,
        network: "solana-mainnet",
      });
    });
  });
});
