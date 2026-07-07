import {
  type DeviceModelId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { array, Codec, optional, string } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { type InstructionInfoDataSource } from "@/modules/solana/instruction-info/data/InstructionInfoDataSource";
import { instructionInfoTypes } from "@/modules/solana/instruction-info/di/instructionInfoTypes";
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

          for (const [discriminator, result] of Object.entries(
            value.descriptors,
          )) {
            if (
              wantedDiscriminators !== null &&
              !wantedDiscriminators.has(discriminator)
            ) {
              continue;
            }
            contexts.push(
              result.caseOf<ClearSignContext>({
                Left: (error) => {
                  this.logger.warn("[load] INSTRUCTION_INFO descriptor error", {
                    data: { programId, discriminator, error: error.message },
                  });
                  return { type: ClearSignContextType.ERROR, error };
                },
                Right: (payload) => ({
                  type: ClearSignContextType.SOLANA_INSTRUCTION_INFO,
                  payload,
                  certificate,
                }),
              }),
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
}
