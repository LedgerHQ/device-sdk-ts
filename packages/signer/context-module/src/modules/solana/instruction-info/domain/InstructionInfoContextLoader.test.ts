/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import {
  type InstructionInfoDataSource,
  type InstructionInfoResult,
} from "@/modules/solana/instruction-info/data/InstructionInfoDataSource";
import {
  type SolanaInstructionEnumVariant,
  type SolanaInstructionInfoPayload,
} from "@/modules/solana/model/SolanaPayloads";
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

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const JUPITER_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

// The data source hands the loader fully-decoded core payloads.
function makeSystemPayload(): SolanaInstructionInfoPayload {
  return {
    programId: SYSTEM_PROGRAM,
    discriminator: "00000000",
    instructionInfo: { data: "0001sys_data", signature: "prodsig_sys" },
    substructures: [
      { kind: 0x00, data: "df1" },
      { kind: 0x00, data: "df2" },
      { kind: 0x01, data: "vfp1" },
    ],
    enumVariants: [],
    idlDescriptor: { typePool: [], rootType: 0 },
    mintAssociations: [],
    valueFlowPorts: [],
    accountResets: [],
    displayFields: [],
  };
}

function makeSystemResult(): InstructionInfoResult {
  return {
    programId: SYSTEM_PROGRAM,
    descriptors: { "00000000": Right(makeSystemPayload()) },
    enumVariants: [],
  };
}

function makeJupiterPayload(): SolanaInstructionInfoPayload {
  return {
    programId: JUPITER_PROGRAM,
    discriminator: "e517cb977ae3ad2a",
    instructionInfo: { data: "0001jup_data", signature: "prodsig_jup" },
    substructures: [],
    enumVariants: [],
    idlDescriptor: { typePool: [], rootType: 0 },
    mintAssociations: [],
    valueFlowPorts: [],
    accountResets: [],
    displayFields: [],
  };
}

function makeJupiterResult(): InstructionInfoResult {
  return {
    programId: JUPITER_PROGRAM,
    descriptors: { e517cb977ae3ad2a: Right(makeJupiterPayload()) },
    enumVariants: [],
  };
}

function makeJupiterRouteResult(
  enumVariants: SolanaInstructionEnumVariant[] = [],
): InstructionInfoResult {
  return {
    programId: JUPITER_PROGRAM,
    descriptors: {
      e517cb977ae3ad2a: Right({ ...makeJupiterPayload(), enumVariants }),
    },
    enumVariants,
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

  const makeLoader = () =>
    new InstructionInfoContextLoader(
      dataSource,
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
          if (programId === SYSTEM_PROGRAM) return Right(makeSystemResult());
          if (programId === JUPITER_PROGRAM) return Right(makeJupiterResult());
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

    it("emits one SOLANA_INSTRUCTION_INFO per matching (programId, discriminator), passing the decoded payload through with the certificate", async () => {
      const loader = makeLoader();
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(makeSystemResult()),
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
      // The loader does not transform — it forwards the data source's payload.
      expect((infoCtx as any).payload).toEqual(makeSystemPayload());
    });

    it("does NOT emit SOLANA_ENUM_VARIANT contexts (those come from EnumVariantContextLoader)", async () => {
      const loader = makeLoader();
      // Pass a pre-decoded variant to confirm the loader never emits SOLANA_ENUM_VARIANT.
      const jupiter = makeJupiterRouteResult([
        {
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "01_raydium_tlv", signature: "prodsig_v46" },
        },
      ]);
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
      const expectedVariants: SolanaInstructionEnumVariant[] = [
        {
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "01_raydium_tlv", signature: "prodsig_v46" },
        },
      ];
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(makeJupiterRouteResult(expectedVariants)),
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

      expect((infoCtx as any).payload.enumVariants).toEqual(expectedVariants);
    });

    it("forwards exactly the enumVariants the data source decoded — no NaN indices", async () => {
      const loader = makeLoader();
      // The data source is responsible for filtering malformed variant keys;
      // the loader forwards whatever pre-decoded variants it receives as-is.
      const validVariant: SolanaInstructionEnumVariant = {
        enumId: "swap",
        variantIndex: 46,
        descriptor: { data: "01_raydium_tlv", signature: "prodsig_v46" },
      };
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(makeJupiterRouteResult([validVariant])),
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

      expect((infoCtx as any).payload.enumVariants).toEqual([validVariant]);
    });

    it("filters descriptors by requested discriminator", async () => {
      const loader = makeLoader();
      const result: InstructionInfoResult = {
        programId: SYSTEM_PROGRAM,
        descriptors: {
          "00000000": Right(makeSystemPayload()),
          "00000001": Right({
            ...makeSystemPayload(),
            discriminator: "00000001",
            instructionInfo: { data: "0001other", signature: "p" },
          }),
        },
        enumVariants: [],
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

    it("emits an ERROR context for a descriptor the data source could not decode", async () => {
      const loader = makeLoader();
      const result: InstructionInfoResult = {
        programId: SYSTEM_PROGRAM,
        descriptors: {
          "00000000": Left(new Error("missing 'test' signature")),
        },
        enumVariants: [],
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

      expect(out).toHaveLength(1);
      expect(out[0]?.type).toBe(ClearSignContextType.ERROR);
      expect((out[0] as any).error.message).toMatch(/missing 'test' signature/);
    });

    it("emits one ERROR context when CAL fails for a program but keeps processing the others", async () => {
      const loader = makeLoader();
      vi.spyOn(dataSource, "getInstructionInfo").mockImplementation(
        async ({ programId }) => {
          if (programId === SYSTEM_PROGRAM) return Right(makeSystemResult());
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

    it("degrades every program to ERROR when certificate loading fails", async () => {
      vi.spyOn(certificateLoader, "loadCertificate").mockRejectedValue(
        new Error("pki-down"),
      );
      vi.spyOn(dataSource, "getInstructionInfo").mockResolvedValue(
        Right(makeSystemResult()),
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
        Right(makeSystemResult()),
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

    it("falls back to default network when input.network is omitted or empty string", async () => {
      const loader = makeLoader();
      const spy = vi
        .spyOn(dataSource, "getInstructionInfo")
        .mockResolvedValue(Right(makeSystemResult()));

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
