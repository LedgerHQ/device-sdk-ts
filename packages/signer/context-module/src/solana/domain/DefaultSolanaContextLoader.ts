import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import {
  LoaderResult,
  SolanaContextTypes,
} from "@/shared/model/SolanaContextTypes";
import { type SolanaDataSource } from "@/solana/data/SolanaDataSource";
import { solanaContextTypes } from "@/solana/di/solanaContextTypes";
import { lifiTypes } from "@/solanaLifi/di/solanaLifiTypes";
import { SolanaLifiContextLoader } from "@/solanaLifi/domain/SolanaLifiContextLoader";
import { solanaTokenTypes } from "@/solanaToken/di/solanaTokenTypes";
import { SolanaTokenContextLoader } from "@/solanaToken/domain/SolanaTokenContextLoader";

import { type SolanaContextLoader } from "./SolanaContextLoader";
import {
  SolanaTransactionContext,
  SolanaTransactionContextResult,
  SolanaTransactionContextResultSuccess,
} from "./solanaContextTypes";

@injectable()
export class DefaultSolanaContextLoader implements SolanaContextLoader {
  private logger: LoggerPublisherService;

  constructor(
    @inject(solanaContextTypes.SolanaDataSource)
    private readonly _dataSource: SolanaDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
    @inject(solanaTokenTypes.SolanaTokenContextLoader)
    private readonly _solanaTokenLoader: SolanaTokenContextLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(lifiTypes.SolanaLifiContextLoader)
    private readonly _solanaLifiLoader: SolanaLifiContextLoader,
  ) {
    this.logger = loggerFactory("DefaultSolanaContextLoader");
  }

  private needsOwnerInfo(context: SolanaTransactionContext): boolean {
    return !!(context.tokenAddress || context.createATA);
  }

  async load(
    solanaContext: SolanaTransactionContext,
  ): Promise<SolanaTransactionContextResult> {
    this.logger.debug("[load] Loading solana context", {
      data: { input: solanaContext },
    });
    const { deviceModelId } = solanaContext;

    const loaderPromises: Promise<LoaderResult>[] = [];

    if (
      this._solanaTokenLoader.canHandle(
        solanaContext,
        SolanaContextTypes.SOLANA_TOKEN,
      )
    ) {
      loaderPromises.push(this._solanaTokenLoader.loadField(solanaContext));
    }

    if (
      this._solanaLifiLoader.canHandle(
        solanaContext,
        SolanaContextTypes.SOLANA_LIFI,
      )
    ) {
      loaderPromises.push(this._solanaLifiLoader.loadField(solanaContext));
    }

    const settledLoaders = await Promise.allSettled(loaderPromises);

    const loadersResults = settledLoaders
      .map((r) => (r.status === "fulfilled" ? r.value : undefined))
      .filter((v): v is LoaderResult => v !== undefined)
      .sort((a, b) => {
        const A = a.type === SolanaContextTypes.SOLANA_TOKEN ? 0 : 1;
        const B = b.type === SolanaContextTypes.SOLANA_TOKEN ? 0 : 1;
        return A - B;
      });

    if (!this.needsOwnerInfo(solanaContext)) {
      this.logger.debug(
        "[load] No tokenAddress or createATA, skipping owner info lookup",
      );
      return Right({ loadersResults });
    }

    const trustedNamePKICertificate: PkiCertificate | undefined =
      await this._certificateLoader.loadCertificate({
        keyId: "domain_metadata_key",
        keyUsage: KeyUsage.TrustedName,
        targetDevice: deviceModelId,
      });

    if (!trustedNamePKICertificate) {
      return Left(
        new Error(
          "[ContextModule] DefaultSolanaContextLoader: trustedNamePKICertificate is missing",
        ),
      );
    }

    const tlvDescriptorEither =
      await this._dataSource.getOwnerInfo(solanaContext);

    return tlvDescriptorEither.map<SolanaTransactionContextResultSuccess>(
      ({ tlvDescriptor }) => ({
        trustedNamePKICertificate,
        tlvDescriptor,
        loadersResults,
      }),
    );
  }
}
