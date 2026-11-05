import {
  DmkNetworkClient,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { SolanaTransactionScanChainId } from "@/modules/solana/model/SolanaTransactionScanChainId";
import { SIGNATURE_TAG } from "@/shared/model/SignatureTags";
import { networkTypes } from "@/shared/network/di/networkTypes";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";

import {
  type SolanaGatedDappsDto,
  solanaGatedDappsDtoCodec,
  solanaGatedDescriptorEntryCodec,
} from "./dto/SolanaGatedDappsDto";
import {
  type GetSolanaGatedDescriptorsParams,
  type SolanaGatedDescriptor,
  type SolanaGatedDescriptorDataSource,
} from "./SolanaGatedDescriptorDataSource";

/** Longest discriminator the Solana app accepts (`CS_DISCRIMINATOR_MAX_SIZE`). */
export const SOLANA_GATED_DISCRIMINATOR_MAX_SIZE = 8;

// Hex made of whole bytes, optionally 0x-prefixed. Empty is allowed: it
// means "program only".
const WHOLE_BYTES_HEX = /^(0x)?([0-9a-fA-F]{2})*$/;

@injectable()
export class HttpSolanaGatedDescriptorDataSource
  implements SolanaGatedDescriptorDataSource
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {
    this.logger = loggerFactory("HttpSolanaGatedDescriptorDataSource");
  }

  async getGatedDescriptors({
    programId,
  }: GetSolanaGatedDescriptorsParams): Promise<
    Either<Error, SolanaGatedDescriptor[]>
  > {
    let response: unknown;
    try {
      response = await this.http.get(`${this.config.cal.url}/gated_dapps`, {
        params: {
          ref: `branch:${this.config.cal.branch}`,
          output: "gated_descriptors",
          contracts: programId,
          // Solana transactions carry no cluster: descriptors are mainnet only.
          chain_id: SolanaTransactionScanChainId.MAINNET,
        },
      });
    } catch (error) {
      return Left(
        new Error(
          `[ContextModule] HttpSolanaGatedDescriptorDataSource: Failed to fetch gated descriptors for ${programId}: ${error}`,
        ),
      );
    }

    return solanaGatedDappsDtoCodec
      .decode(response)
      .caseOf<Either<Error, SolanaGatedDescriptor[]>>({
        Left: (error) =>
          Left(
            new Error(
              `[ContextModule] HttpSolanaGatedDescriptorDataSource: Invalid gated descriptors response for ${programId}: ${error}`,
            ),
          ),
        Right: (dto) => Right(this.toDescriptors(programId, dto)),
      });
  }

  private toDescriptors(
    programId: string,
    dto: SolanaGatedDappsDto,
  ): SolanaGatedDescriptor[] {
    const descriptors: SolanaGatedDescriptor[] = [];
    for (const item of dto) {
      const entries = item.gated_descriptors[programId];
      if (typeof entries !== "object" || entries === null) continue;

      for (const raw of Object.values(entries)) {
        // One malformed entry is skipped; the others still count.
        const decoded = solanaGatedDescriptorEntryCodec.decode(raw);
        if (decoded.isLeft()) {
          this.logger.warn("[getGatedDescriptors] Skipping malformed entry", {
            data: { programId, error: decoded.extract() },
          });
          continue;
        }
        const entry = decoded.unsafeCoerce();
        // The selector carries the discriminator, as hex. Only an explicit
        // empty selector means "program only": a missing one must not widen
        // the match, or the DMK could send a descriptor the device rejects.
        if (entry.selector === undefined) {
          this.logger.warn(
            "[getGatedDescriptors] Skipping entry without selector",
            {
              data: { programId },
            },
          );
          continue;
        }
        const discriminatorHex = entry.selector;
        const discriminator = parseDiscriminator(discriminatorHex);
        if (discriminator === null) {
          this.logger.warn("[getGatedDescriptors] Skipping bad discriminator", {
            data: { programId, discriminator: discriminatorHex },
          });
          continue;
        }

        const signature = entry.signatures?.[this.config.cal.mode];
        if (signature === undefined) {
          this.logger.warn("[getGatedDescriptors] Skipping unsigned entry", {
            data: { programId, discriminator: discriminatorHex },
          });
          continue;
        }

        descriptors.push({
          programId,
          discriminator,
          signedDescriptor: HexStringUtils.appendSignatureToPayload(
            entry.descriptor,
            signature,
            SIGNATURE_TAG,
          ),
        });
      }
    }
    return descriptors;
  }
}

function parseDiscriminator(hex: string): Uint8Array | null {
  if (!WHOLE_BYTES_HEX.test(hex)) return null;
  const digits = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(digits.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(digits.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes.length <= SOLANA_GATED_DISCRIMINATOR_MAX_SIZE ? bytes : null;
}
