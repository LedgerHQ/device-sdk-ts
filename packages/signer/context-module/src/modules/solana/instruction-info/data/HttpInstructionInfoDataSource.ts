import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { SolanaTransactionScanChainId } from "@/modules/solana/model/SolanaTransactionScanChainId";
import { networkTypes } from "@/shared/network/di/networkTypes";

import {
  GetInstructionInfoParams,
  InstructionInfoDataSource,
  InstructionInfoResult,
  SolanaProgramNotFoundError,
} from "./InstructionInfoDataSource";
import {
  type CalInstructionDescriptorDto,
  calInstructionProgramCodec,
  type CalInstructionProgramDto,
} from "./InstructionInfoDto";
import {
  type CalMode,
  toBasicFlowTags,
  toInstructionInfoPayload,
  toProgramEnumVariants,
} from "./InstructionInfoMapper";

// Maps the DMK network label to the numeric CAL `chain_id` (the extended
// Solana network ids 900/901/902). Unknown labels fall back to mainnet.
const CHAIN_ID_BY_NETWORK: Record<string, SolanaTransactionScanChainId> = {
  "solana-mainnet": SolanaTransactionScanChainId.MAINNET,
  "solana-devnet": SolanaTransactionScanChainId.DEVNET,
  "solana-testnet": SolanaTransactionScanChainId.TESTNET,
};

// One sign looks up the same programs several times (signing-route lookup,
// instruction-info and enum-variant loaders), so results are memoized for a
// short time. The TTL only has to cover one sign; the size cap bounds memory.
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 64;

type InstructionInfoCacheEntry = {
  expiresAt: number;
  result: Promise<Either<Error, InstructionInfoResult>>;
};

@injectable()
export class HttpInstructionInfoDataSource
  implements InstructionInfoDataSource
{
  // Keyed by `${chainId}:${programId}`. The in-flight promise is stored, so
  // concurrent callers share one HTTP call.
  private readonly cache = new Map<string, InstructionInfoCacheEntry>();

  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public getInstructionInfo({
    programId,
    network,
  }: GetInstructionInfoParams): Promise<Either<Error, InstructionInfoResult>> {
    const chainId =
      CHAIN_ID_BY_NETWORK[network] ?? SolanaTransactionScanChainId.MAINNET;
    const key = `${chainId}:${programId}`;
    const now = Date.now();

    const cached = this.cache.get(key);
    if (cached !== undefined && cached.expiresAt > now) {
      return cached.result;
    }

    const result = this.fetchInstructionInfo(programId, chainId);
    this.cache.delete(key);
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      // Map iterates in insertion order: evict the oldest entry.
      const oldest = this.cache.keys().next();
      if (!oldest.done) this.cache.delete(oldest.value);
    }
    this.cache.set(key, { expiresAt: now + CACHE_TTL_MS, result });

    // Failures are not cached so the next caller retries. "Program not found"
    // is a valid CAL answer and stays cached.
    void result.then(
      (either) => {
        const cacheable = either.caseOf({
          Left: (error) => error instanceof SolanaProgramNotFoundError,
          Right: () => true,
        });
        if (!cacheable) this.evict(key, result);
      },
      () => this.evict(key, result),
    );

    return result;
  }

  private evict(
    key: string,
    result: Promise<Either<Error, InstructionInfoResult>>,
  ): void {
    // Only drop our own entry, not a newer one stored under the same key.
    if (this.cache.get(key)?.result === result) {
      this.cache.delete(key);
    }
  }

  private async fetchInstructionInfo(
    programId: string,
    chainId: SolanaTransactionScanChainId,
  ): Promise<Either<Error, InstructionInfoResult>> {
    let data: unknown;
    try {
      data = await this.http.get(`${this.config.cal.url}/solana_programs`, {
        params: {
          id: programId,
          chain_id: chainId,
          output: "id,chain_id,instructions",
          ref: `branch:${this.config.cal.branch}`,
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return Left(
        new Error(
          `[ContextModule] HttpInstructionInfoDataSource: Failed to fetch instruction descriptors: ${reason}`,
        ),
      );
    }

    if (!Array.isArray(data)) {
      return Left(
        new Error(
          `[ContextModule] HttpInstructionInfoDataSource: unexpected response for program ${programId}`,
        ),
      );
    }

    // CAL answers with an empty array for a program it doesn't know.
    if (data.length === 0) {
      return Left(
        new SolanaProgramNotFoundError(
          programId,
          `[ContextModule] HttpInstructionInfoDataSource: empty response for program ${programId}`,
        ),
      );
    }

    // Select the program object whose `id` matches the requested `programId`
    // (the response is an array, one object per requested id).
    const program = data.find(
      (entry): entry is { id: unknown } =>
        entry != null &&
        typeof entry === "object" &&
        (entry as { id?: unknown }).id === programId,
    );
    if (program === undefined) {
      return Left(
        new SolanaProgramNotFoundError(
          programId,
          `[ContextModule] HttpInstructionInfoDataSource: no descriptors for program ${programId}`,
        ),
      );
    }

    // Validate the program shape so the mapper can dereference `descriptor` /
    // `enum_variants` without runtime-throwing on a malformed CAL payload. A
    // malformed program degrades to a per-program ERROR rather than rejecting
    // the batch. On success we transform each validated DTO into the core
    // payload so the loader never sees the CAL DTO shapes.
    return calInstructionProgramCodec
      .decode(program)
      .caseOf<Either<Error, InstructionInfoResult>>({
        Left: (error) =>
          Left(
            new Error(
              `[ContextModule] HttpInstructionInfoDataSource: malformed descriptors for program ${programId}: ${error}`,
            ),
          ),
        Right: () => {
          const mode: CalMode = this.config.cal.mode ?? "prod";
          // The codec strips undeclared fields, so we key the original
          // (full) instruction objects by `discriminator_hex` — the cast is
          // justified now that the shape has been validated. A descriptor
          // without a discriminator (single-instruction programs such as SPL
          // Memo) is keyed under the empty string.
          const instructions = (program as CalInstructionProgramDto)
            .instructions;
          const descriptorsByDiscriminator: Record<
            string,
            CalInstructionDescriptorDto
          > = Object.fromEntries(
            instructions.map((dto) => [dto.discriminator_hex ?? "", dto]),
          );
          const mapped = Object.fromEntries(
            Object.entries(descriptorsByDiscriminator).map(
              ([discriminator, dto]) => [
                discriminator,
                toInstructionInfoPayload(programId, discriminator, dto, mode),
              ],
            ),
          );
          return Right({
            programId,
            descriptors: mapped,
            enumVariants: toProgramEnumVariants(
              descriptorsByDiscriminator,
              mode,
            ),
            basicFlowTags: toBasicFlowTags(descriptorsByDiscriminator),
          });
        },
      });
  }
}
