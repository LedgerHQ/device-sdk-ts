import { inject, injectable } from "inversify";
import { Left } from "purify-ts";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type SolanaDataSource } from "@/solana/data/SolanaDataSource";
import { solanaContextTypes } from "@/solana/di/solanaContextTypes";
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
  ) {}

  async load(
    solanaContext: SolanaTransactionContext,
  ): Promise<SolanaTransactionContextResult> {
    const { deviceModelId } = solanaContext;

    const trustedNameCertificate =
      await this._certificateLoader.loadCertificate({
        keyId: "domain_metadata_key",
        keyUsage: KeyUsage.TrustedName,
        targetDevice: deviceModelId,
      });

    const loaders = [this._solanaTokenLoader];

    const settledLoaders = await Promise.allSettled(
      loaders
        .filter((l) => l.canHandle(solanaContext))
        .map((l) => l.load(solanaContext)),
    );

    const loadersResults = settledLoaders
      .map((r) => (r.status === "fulfilled" ? r.value : undefined))
      .filter((v) => v !== undefined);

    const ownerInfoEither = await this._dataSource.getOwnerInfo(solanaContext);

    return ownerInfoEither.map(
      ({ descriptor, tokenAccount, owner, contract }) => ({
        certificate: trustedNameCertificate,
        descriptor,
        tokenAccount,
        owner,
        contract,
        loadersResults,
      }),
    );
  }
}
