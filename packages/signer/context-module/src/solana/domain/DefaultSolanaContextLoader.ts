import { inject, injectable } from "inversify";
import { Left } from "purify-ts";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
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
} from "./solanaContextTypes";

@injectable()
export class DefaultSolanaContextLoader implements SolanaContextLoader {
  constructor(
    @inject(solanaContextTypes.SolanaDataSource)
    private readonly _dataSource: SolanaDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
    @inject(solanaTokenTypes.SolanaTokenContextLoader)
    private readonly _solanaTokenLoader: SolanaTokenContextLoader,
    @inject(lifiTypes.SolanaLifiContextLoader)
    private readonly _solanaLifiLoader: SolanaLifiContextLoader,
  ) {}

  async load(
    solanaContext: SolanaTransactionContext,
  ): Promise<SolanaTransactionContextResult> {
    const { deviceModelId } = solanaContext;

    const trustedNamePKICertificate =
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

    const loaderEntries = [
      {
        loader: this._solanaTokenLoader,
        expectedType: SolanaContextTypes.SOLANA_TOKEN,
      },
      {
        loader: this._solanaLifiLoader,
        expectedType: SolanaContextTypes.SOLANA_LIFI,
      },
    ] as const;

    const loaderPromises = loaderEntries
      .map(({ loader, expectedType }) => {
        if (loader.canHandle(solanaContext, expectedType)) {
          if (expectedType === SolanaContextTypes.SOLANA_TOKEN) {
            return loader.loadField({
              deviceModelId: solanaContext.deviceModelId,
              tokenInternalId: solanaContext.tokenInternalId!,
            });
          } else if (expectedType === SolanaContextTypes.SOLANA_LIFI) {
            return loader.loadField({
              deviceModelId: solanaContext.deviceModelId,
              templateId: solanaContext.templateId!,
            });
          }
        }
        return undefined;
      })
      .filter((p) => p !== undefined);

    const settledLoaders = await Promise.allSettled(loaderPromises);

    const loadersResults = settledLoaders
      .map((r) => (r.status === "fulfilled" ? r.value : undefined))
      .filter((v): v is LoaderResult => v !== undefined)
      // always sort with SOLANA_TOKEN first
      .sort((a, b) => {
        const A = a.type === SolanaContextTypes.SOLANA_TOKEN ? 0 : 1;
        const B = b.type === SolanaContextTypes.SOLANA_TOKEN ? 0 : 1;
        return A - B;
      });

    const tlvDescriptorEither =
      await this._dataSource.getOwnerInfo(solanaContext);

    return tlvDescriptorEither.map(({ tlvDescriptor }) => ({
      trustedNamePKICertificate,
      tlvDescriptor,
      loadersResults,
    }));
  }
}
