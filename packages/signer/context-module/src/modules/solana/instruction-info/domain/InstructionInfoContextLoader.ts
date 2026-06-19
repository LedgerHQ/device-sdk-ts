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
import { type InstructionInfoDataSource } from "@/modules/solana/instruction-info/data/InstructionInfoDataSource";
import {
  type CalInstructionDescriptorDto,
  type CalSignatures,
} from "@/modules/solana/instruction-info/data/InstructionInfoDto";
import { instructionInfoTypes } from "@/modules/solana/instruction-info/di/instructionInfoTypes";
import {
  type SolanaInstructionEnumVariant,
  type SolanaInstructionInfoPayload,
  type SolanaInstructionSubstructure,
  SolanaInstructionSubstructureKind,
} from "@/modules/solana/model/SolanaPayloads";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { loadCertificateResult } from "@/shared/utils/certificateResult";
import { deviceModelIdCodec } from "@/shared/utils/deviceModelIdCodec";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_INSTRUCTION_INFO,
];

const NETWORK_DEFAULT = "solana-mainnet";

/**
 * Per-instruction reference the caller provides for the TX it wants to
 * clear-sign. Discriminator is optional: when omitted, the loader emits
 * every descriptor CAL returns for that `programId`. When present, the
 * loader filters down to descriptors whose `discriminator` matches.
 */
export type SolanaInstructionRef = {
  programId: string;
  discriminator?: string;
};

export type SolanaInstructionInfoContextInput = {
  deviceModelId: DeviceModelId;
  instructions: SolanaInstructionRef[];
  network?: string;
};

const instructionRefCodec = Codec.interface({
  programId: string,
  discriminator: optional(string),
});

const solanaInstructionInfoInputCodec = Codec.interface({
  deviceModelId: deviceModelIdCodec,
  instructions: array(instructionRefCodec),
  network: optional(string),
});

/**
 * Emits SOLANA_INSTRUCTION_INFO contexts for the requested instructions.
 * Enum-variant emission lives in the sibling {@link EnumVariantContextLoader}.
 */
@injectable()
export class InstructionInfoContextLoader
  implements ContextLoader<SolanaInstructionInfoContextInput>
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
    this.logger = loggerFactory("InstructionInfoContextLoader");
  }

  public canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is SolanaInstructionInfoContextInput {
    if (!SUPPORTED_TYPES.every((t) => expectedTypes.includes(t))) {
      return false;
    }
    return solanaInstructionInfoInputCodec.decode(input).caseOf({
      Left: () => false,
      Right: ({ instructions }) =>
        instructions.length > 0 &&
        instructions.every((ix) => ix.programId.length > 0),
    });
  }

  public async load(
    input: SolanaInstructionInfoContextInput,
  ): Promise<ClearSignContext[]> {
    const network = input.network || NETWORK_DEFAULT;
    const distinctProgramIds = Array.from(
      new Set(input.instructions.map((ix) => ix.programId)),
    );

    this.logger.debug("[load] Fetching instruction descriptors", {
      data: {
        network,
        programCount: distinctProgramIds.length,
        instructionCount: input.instructions.length,
      },
    });

    // Run cert load in parallel with CAL fetches — neither depends on the
    // other. The tagged-Result wrapper lets us preserve the data fetches
    // if cert fails so we can surface a per-program ERROR rather than
    // silently dropping them.
    const certPromise = loadCertificateResult(this.certificateLoader, {
      keyId: KeyId.TokenMetadataKey,
      keyUsage: KeyUsage.CoinMeta,
      targetDevice: input.deviceModelId,
    });

    // One CAL call per program, fanned out in parallel.
    const dataPromise = Promise.all(
      distinctProgramIds.map(async (programId) => ({
        programId,
        either: await this.dataSource.getInstructionInfo({
          programId,
          network,
        }),
      })),
    );

    const [certResult, results] = await Promise.all([certPromise, dataPromise]);

    if (!certResult.ok || !certResult.value) {
      const error = certResult.ok
        ? new Error(
            "[ContextModule] InstructionInfoContextLoader: certificate is missing",
          )
        : certResult.error;
      this.logger.warn("[load] INSTRUCTION_INFO certificate unavailable", {
        data: { error: error.message },
      });
      return distinctProgramIds.map(() => ({
        type: ClearSignContextType.ERROR,
        error,
      }));
    }
    const certificate = certResult.value;

    const contexts: ClearSignContext[] = [];

    for (const { programId, either } of results) {
      either.caseOf<void>({
        Left: (err) => {
          this.logger.warn(
            "[load] Failed to fetch instruction descriptors for program",
            { data: { programId, error: err.message } },
          );
          contexts.push({
            type: ClearSignContextType.ERROR,
            error: err,
          });
        },
        Right: (value) => {
          const wantedDiscriminators = this.collectWantedDiscriminators(
            programId,
            input.instructions,
          );

          for (const [discriminator, dto] of Object.entries(
            value.descriptors,
          )) {
            if (
              wantedDiscriminators !== null &&
              !wantedDiscriminators.has(discriminator)
            ) {
              continue;
            }
            contexts.push(
              this.toInstructionInfoContext(discriminator, dto, certificate),
            );
          }
        },
      });
    }

    this.logger.debug("[load] Emitted contexts", {
      data: { count: contexts.length },
    });

    return contexts;
  }

  /**
   * Returns the set of discriminators the caller has explicitly asked
   * about for this `programId`, or `null` when the caller wants every
   * descriptor CAL has for the program.
   */
  private collectWantedDiscriminators(
    programId: string,
    instructions: SolanaInstructionRef[],
  ): Set<string> | null {
    const set = new Set<string>();
    let hasUnconstrained = false;
    for (const ix of instructions) {
      if (ix.programId !== programId) continue;
      if (ix.discriminator === undefined) {
        hasUnconstrained = true;
      } else {
        set.add(ix.discriminator);
      }
    }
    return hasUnconstrained ? null : set;
  }

  private toInstructionInfoContext(
    discriminator: string,
    dto: CalInstructionDescriptorDto,
    certificate: Awaited<ReturnType<PkiCertificateLoader["loadCertificate"]>>,
  ): ClearSignContext {
    const info = dto.instruction_info;
    const signature = this.pickSignature(info.descriptor.signatures);
    if (!signature) {
      const error = new Error(
        `[ContextModule] InstructionInfoContextLoader: missing '${this.config.cal.mode ?? "prod"}' signature for (${info.program_id}, ${discriminator})`,
      );
      this.logger.warn("[load] INSTRUCTION_INFO missing signature", {
        data: { programId: info.program_id, discriminator },
      });
      return { type: ClearSignContextType.ERROR, error };
    }

    const substructures: SolanaInstructionSubstructure[] = [
      ...(dto.display_fields ?? []).map((s) => ({
        kind: SolanaInstructionSubstructureKind.DISPLAY_FIELD,
        data: s.descriptor,
      })),
      ...(dto.value_flow_ports ?? []).map((s) => ({
        kind: SolanaInstructionSubstructureKind.VALUE_FLOW_PORT,
        data: s.descriptor,
      })),
      ...(dto.hide_rules ?? []).map((s) => ({
        kind: SolanaInstructionSubstructureKind.HIDE_RULE,
        data: s.descriptor,
      })),
      ...(dto.account_resets ?? []).map((s) => ({
        kind: SolanaInstructionSubstructureKind.ACCOUNT_RESET,
        data: s.descriptor,
      })),
    ];

    // Flatten the CAL-bundled enum variants (keyed enumId to variantIndex) into
    // a flat list. The signed TLV feeds the host's type-pool decode cache, the
    // signature is best-effort (only needed when streaming the selected
    // variant, not for decoding).
    const enumVariants: SolanaInstructionEnumVariant[] = [];
    for (const [enumId, variants] of Object.entries(dto.enum_variants ?? {})) {
      for (const [variantIndex, variant] of Object.entries(variants)) {
        enumVariants.push({
          enumId,
          variantIndex: Number(variantIndex),
          descriptor: {
            data: variant.data,
            signature: this.pickSignature(variant.signatures) ?? "",
          },
        });
      }
    }

    const payload: SolanaInstructionInfoPayload = {
      programId: info.program_id,
      discriminator,
      instructionInfo: {
        data: info.descriptor.data,
        signature,
      },
      substructures,
      enumVariants,
    };

    return {
      type: ClearSignContextType.SOLANA_INSTRUCTION_INFO,
      payload,
      certificate,
    };
  }

  private pickSignature(signatures: CalSignatures): string | undefined {
    const mode = this.config.cal.mode ?? "prod";
    return signatures[mode];
  }
}
