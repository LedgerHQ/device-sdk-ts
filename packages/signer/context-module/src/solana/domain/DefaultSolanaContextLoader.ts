import { inject, injectable } from "inversify";
import { Left } from "purify-ts";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type SolanaDataSource } from "@/solana/data/SolanaDataSource";
import { solanaContextTypes } from "@/solana/di/solanaContextTypes";

import { SolanaContextLoader } from "./SolanaContextLoader";
import {
  SolanaTransactionContext,
  SolanaTransactionContextResult,
} from "./solanaContextTypes";

@injectable()
export class DefaultSolanaContextLoader implements SolanaContextLoader {
  private _dataSource: SolanaDataSource;

  constructor(
    @inject(solanaContextTypes.SolanaDataSource)
    dataSource: SolanaDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
  ) {
    this._dataSource = dataSource;
  }

  async load(
    solanaContext: SolanaTransactionContext,
  ): Promise<SolanaTransactionContextResult> {
    // load the CAL certificate
    const certificate = await this._certificateLoader.loadCertificate({
      keyId: "domain_metadata_key",
      keyUsage: KeyUsage.TrustedName,
      targetDevice: solanaContext.deviceModelId,
    });
    if (!certificate) {
      return Left(
        new Error(
          "[ContextModule] - DefaultSolanaContextLoader: CAL certificate is undefined",
        ),
      );
    }

    // load the CAL coin meta certificate
    const coinMetaCertificate = await this._certificateLoader.loadCertificate({
      keyId: "token_metadata_key",
      keyUsage: KeyUsage.CoinMeta,
      targetDevice: solanaContext.deviceModelId,
    });
    if (!certificate) {
      return Left(
        new Error(
          "[ContextModule] - DefaultSolanaContextLoader: CAL certificate is undefined",
        ),
      );
    }

    // fetch the Solana context
    return (await this._dataSource.getOwnerInfo(solanaContext)).map(
      ({ descriptor, tokenAccount, owner, contract }) => ({
        descriptor,
        tokenAccount,
        owner,
        contract,
        certificate,
        coinMetaCertificate,
      }),
    );
  }
}
