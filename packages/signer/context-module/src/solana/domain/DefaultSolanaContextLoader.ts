import { inject, injectable } from "inversify";
import { Left } from "purify-ts";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type SolanaDataSource } from "@/solana/data/SolanaDataSource";
import { solanaContextTypes } from "@/solana/di/solanaContextTypes";
import { lifiTypes } from "@/solanaLifi/di/solanaLifiTypes";
import { type SolanaLifiContextLoader } from "@/solanaLifi/domain/SolanaLifiContextLoader";
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

    const loaders = [this._solanaTokenLoader, this._solanaLifiLoader];

    const settledLoaders = await Promise.allSettled(
      loaders
        .filter((l) => l.canHandle(solanaContext))
        .map((l) => l.load(solanaContext)),
    );

    const loadersResults = settledLoaders
      .map((r) => (r.status === "fulfilled" ? r.value : undefined))
      .filter((v) => v !== undefined);

    const tlvDescriptorEither =
      await this._dataSource.getOwnerInfo(solanaContext);

    return tlvDescriptorEither.map(({ tlvDescriptor }) => ({
      trustedNamePKICertificate,
      tlvDescriptor,
      loadersResults,
    }));
  }
}
