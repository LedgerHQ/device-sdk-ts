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
import { type SolanaTokenInfoPayload } from "@/modules/solana/model/SolanaPayloads";
import {
  type TokenInfoDataSource,
  type TokenInfoResult,
} from "@/modules/solana/token-info/data/TokenInfoDataSource";
import { tokenInfoTypes } from "@/modules/solana/token-info/di/tokenInfoTypes";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { loadCertificateResult } from "@/shared/utils/certificateResult";
import { deviceModelIdCodec } from "@/shared/utils/deviceModelIdCodec";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_TOKEN_INFO,
];

const NETWORK_DEFAULT = "solana-mainnet";

/**
 * Input shape for the new clear-signing token-info lookup. The dedup key
 * is the on-chain **mint pubkey**, not the legacy Ledger CAL internal id
 * used by the original {@link TokenContextLoader}.
 */
export type SolanaTokenInfoContextInput = {
  deviceModelId: DeviceModelId;
  mints: string[];
  network?: string;
};

const solanaTokenInfoInputCodec = Codec.interface({
  deviceModelId: deviceModelIdCodec,
  mints: array(string),
  network: optional(string),
});

@injectable()
export class TokenInfoContextLoader
  implements ContextLoader<SolanaTokenInfoContextInput>
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(tokenInfoTypes.TokenInfoDataSource)
    private readonly dataSource: TokenInfoDataSource,
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("TokenInfoContextLoader");
  }

  public canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is SolanaTokenInfoContextInput {
    if (!SUPPORTED_TYPES.every((t) => expectedTypes.includes(t))) return false;
    return solanaTokenInfoInputCodec.decode(input).caseOf({
      Left: () => false,
      Right: ({ mints }) =>
        mints.length > 0 && mints.every((m) => m.length > 0),
    });
  }

  public async load(
    input: SolanaTokenInfoContextInput,
  ): Promise<ClearSignContext[]> {
    const network = input.network || NETWORK_DEFAULT;
    const uniqueMints = Array.from(new Set(input.mints));

    this.logger.debug("[load] Fetching TOKEN_INFO descriptors", {
      data: { network, mintCount: uniqueMints.length },
    });

    // Cert load and per-mint fetches are independent — kick them off
    // together. The tagged-Result wrapper on the cert lets us still
    // return per-mint ERROR contexts on PKI failure without dropping
    // the data fetches that already started.
    const certPromise = loadCertificateResult(this.certificateLoader, {
      keyId: KeyId.TokenMetadataKey,
      keyUsage: KeyUsage.CoinMeta,
      targetDevice: input.deviceModelId,
    });

    const dataPromise = Promise.all(
      uniqueMints.map(async (mint) => ({
        mint,
        either: await this.dataSource.getTokenInfo({ mint, network }),
      })),
    );

    const [certResult, results] = await Promise.all([certPromise, dataPromise]);

    if (!certResult.ok || !certResult.value) {
      const error = certResult.ok
        ? new Error(
            "[ContextModule] TokenInfoContextLoader: certificate is missing",
          )
        : certResult.error;
      this.logger.warn("[load] TOKEN_INFO certificate unavailable", {
        data: { error: error.message },
      });
      return uniqueMints.map(() => ({
        type: ClearSignContextType.ERROR,
        error,
      }));
    }
    const certificate = certResult.value;

    const mode = this.config.cal.mode ?? "prod";

    return results.map(({ mint, either }) =>
      either.caseOf<ClearSignContext>({
        Left: (error) => {
          this.logger.warn("[load] TOKEN_INFO fetch failed", {
            data: { mint, error: error.message },
          });
          return { type: ClearSignContextType.ERROR, error };
        },
        Right: (value: TokenInfoResult) => {
          const signature = value.descriptor.signatures[mode];
          if (!signature) {
            const error = new Error(
              `[ContextModule] TokenInfoContextLoader: missing '${mode}' signature for mint ${mint}`,
            );
            this.logger.warn("[load] TOKEN_INFO missing signature", {
              data: { mint, mode },
            });
            return { type: ClearSignContextType.ERROR, error };
          }
          const payload: SolanaTokenInfoPayload = {
            mint,
            descriptor: {
              data: value.descriptor.data,
              signature,
            },
          };
          return {
            type: ClearSignContextType.SOLANA_TOKEN_INFO,
            payload,
            certificate,
          };
        },
      }),
    );
  }
}
