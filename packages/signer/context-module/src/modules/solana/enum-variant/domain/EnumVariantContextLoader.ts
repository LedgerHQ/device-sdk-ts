import {
  type DeviceModelId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { array, Codec, optional, string } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import {
  type InstructionInfoDataSource,
  type InstructionInfoResult,
} from "@/modules/solana/instruction-info/data/InstructionInfoDataSource";
import { type CalSignatures } from "@/modules/solana/instruction-info/data/InstructionInfoDto";
import { instructionInfoTypes } from "@/modules/solana/instruction-info/di/instructionInfoTypes";
import { type SolanaEnumVariantPayload } from "@/modules/solana/model/SolanaPayloads";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { loadCertificateResult } from "@/shared/utils/certificateResult";
import { deviceModelIdCodec } from "@/shared/utils/deviceModelIdCodec";
import { u16Codec } from "@/shared/utils/uIntCodec";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_ENUM_VARIANT,
];

const NETWORK_DEFAULT = "solana-mainnet";

/**
 * One enum-variant selection the caller wants resolved. `variantIndex` is
 * constrained to a u16 (0..=65535).
 */
export type SolanaEnumVariantSelection = {
  programId: string;
  enumId: string;
  variantIndex: number;
};

export type SolanaEnumVariantContextInput = {
  deviceModelId: DeviceModelId;
  selections: SolanaEnumVariantSelection[];
  network?: string;
};

const enumVariantSelectionCodec = Codec.interface({
  programId: string,
  enumId: string,
  variantIndex: u16Codec,
});

const solanaEnumVariantInputCodec = Codec.interface({
  deviceModelId: deviceModelIdCodec,
  selections: array(enumVariantSelectionCodec),
  network: optional(string),
});

/**
 * Emits one SOLANA_ENUM_VARIANT context per `(programId, enumId,
 * variantIndex)` selection: fetches the CAL response for each distinct
 * program, looks up the matching variant, and emits only the selected ones.
 *
 * Shares {@link InstructionInfoDataSource} with
 * {@link InstructionInfoContextLoader}.
 */
@injectable()
export class EnumVariantContextLoader
  implements ContextLoader<SolanaEnumVariantContextInput>
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(instructionInfoTypes.InstructionInfoDataSource)
    private readonly dataSource: InstructionInfoDataSource,
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("EnumVariantContextLoader");
  }

  public canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is SolanaEnumVariantContextInput {
    if (!SUPPORTED_TYPES.every((t) => expectedTypes.includes(t))) return false;
    return solanaEnumVariantInputCodec.decode(input).caseOf({
      Left: () => false,
      Right: ({ selections }) =>
        selections.length > 0 &&
        selections.every((s) => s.programId.length > 0 && s.enumId.length > 0),
    });
  }

  public async load(
    input: SolanaEnumVariantContextInput,
  ): Promise<ClearSignContext[]> {
    const network = input.network || NETWORK_DEFAULT;
    const distinctProgramIds = Array.from(
      new Set(input.selections.map((s) => s.programId)),
    );

    this.logger.debug("[load] Fetching enum variants", {
      data: {
        network,
        programCount: distinctProgramIds.length,
        selectionCount: input.selections.length,
      },
    });

    // Cert load and CAL fetches are independent — run them in parallel. A
    // PKI failure still degrades each selection to ERROR.
    const certPromise = loadCertificateResult(this.certificateLoader, {
      keyId: KeyId.TokenMetadataKey,
      keyUsage: KeyUsage.CoinMeta,
      targetDevice: input.deviceModelId,
    });

    const dataPromise = Promise.all(
      distinctProgramIds.map((programId) =>
        this.dataSource.getInstructionInfo({ programId, network }),
      ),
    );

    const [certResult, results] = await Promise.all([certPromise, dataPromise]);

    if (!certResult.ok || !certResult.value) {
      const error = certResult.ok
        ? new Error(
            "[ContextModule] EnumVariantContextLoader: certificate is missing",
          )
        : certResult.error;
      this.logger.warn("[load] ENUM_VARIANT certificate unavailable", {
        data: { error: error.message },
      });
      return input.selections.map(() => ({
        type: ClearSignContextType.ERROR,
        error,
      }));
    }
    const certificate = certResult.value;

    const programToEither = new Map(
      distinctProgramIds.map((programId, i) => [programId, results[i]!]),
    );

    const mode = this.config.cal.mode ?? "prod";

    return input.selections.map((selection) => {
      const either = programToEither.get(selection.programId);
      if (!either) {
        const error = new Error(
          `[ContextModule] EnumVariantContextLoader: no CAL response for program ${selection.programId}`,
        );
        this.logger.warn("[load] ENUM_VARIANT fetch failed", {
          data: {
            programId: selection.programId,
            enumId: selection.enumId,
            variantIndex: selection.variantIndex,
            error: error.message,
          },
        });
        return { type: ClearSignContextType.ERROR, error };
      }

      return either.caseOf<ClearSignContext>({
        Left: (err) => {
          this.logger.warn("[load] ENUM_VARIANT fetch failed", {
            data: {
              programId: selection.programId,
              enumId: selection.enumId,
              variantIndex: selection.variantIndex,
              error: err.message,
            },
          });
          return { type: ClearSignContextType.ERROR, error: err };
        },
        Right: (value) => {
          const variant = this.lookupVariant(value, selection);
          if (!variant) {
            const error = new Error(
              `[ContextModule] EnumVariantContextLoader: CAL has no enum variant for (${selection.programId}, ${selection.enumId}, ${selection.variantIndex})`,
            );
            this.logger.warn("[load] ENUM_VARIANT not found in CAL response", {
              data: {
                programId: selection.programId,
                enumId: selection.enumId,
                variantIndex: selection.variantIndex,
              },
            });
            return { type: ClearSignContextType.ERROR, error };
          }

          const signature = variant.signatures[mode];
          if (!signature) {
            const error = new Error(
              `[ContextModule] EnumVariantContextLoader: missing '${mode}' signature for (${selection.programId}, ${selection.enumId}, ${selection.variantIndex})`,
            );
            this.logger.warn("[load] ENUM_VARIANT missing signature", {
              data: {
                programId: selection.programId,
                enumId: selection.enumId,
                variantIndex: selection.variantIndex,
                mode,
              },
            });
            return { type: ClearSignContextType.ERROR, error };
          }

          const payload: SolanaEnumVariantPayload = {
            programId: selection.programId,
            enumId: selection.enumId,
            variantIndex: selection.variantIndex,
            descriptor: {
              data: variant.data,
              signature,
            },
          };
          return {
            type: ClearSignContextType.SOLANA_ENUM_VARIANT,
            payload,
            certificate,
          };
        },
      });
    });
  }

  /**
   * Find the CAL enum variant entry for a selection. CAL nests
   * `enum_variants` inside each instruction descriptor, so we scan every
   * descriptor for the program looking for a matching `(enumId, variantIndex)`
   * — CAL guarantees uniqueness of this key across a program's instructions.
   */
  private lookupVariant(
    result: InstructionInfoResult,
    selection: SolanaEnumVariantSelection,
  ): { data: string; signatures: CalSignatures } | undefined {
    for (const dto of Object.values(result.descriptors)) {
      const variants = dto.enum_variants?.[selection.enumId];
      if (!variants) continue;
      // CAL keys variants by their stringified u16 index. Iterate then check
      // u16 equality through the codec so malformed keys ("7abc", "-1",
      // "1e10") are rejected rather than silently truncated by parseInt.
      for (const [indexStr, variant] of Object.entries(variants)) {
        const parsed = u16Codec.decode(Number(indexStr));
        if (parsed.isLeft()) continue;
        if (parsed.extract() === selection.variantIndex) {
          return variant;
        }
      }
    }
    return undefined;
  }
}
