import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { PkiCertificate } from "@/pki/model/PkiCertificate";
import { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";
import {
  type SolanaTokenDataSource,
  TokenDataResponse,
} from "@/solanaToken/data/SolanaTokenDataSource";
import { SolanaContextTypes } from "@/solanaToken/domain/SolanaTokenContext";
import { tokenTypes } from "@/token/di/tokenTypes";

import {
  SolanaTokenContext,
  SolanaTokenContextResult,
  SolanaTokenData,
} from "./SolanaTokenContext";

@injectable()
export class SolanaTokenContextLoader implements SolanaTokenContext {
  constructor(
    @inject(tokenTypes.TokenDataSource)
    private readonly dataSource: SolanaTokenDataSource,
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
  ) {}

  public canHandle(solanaTokenContextInput: SolanaTransactionContext): boolean {
    return !!solanaTokenContextInput.tokenInternalId;
  }

  public async load(
    solanaTokenContextInput: SolanaTransactionContext,
  ): Promise<SolanaTokenContextResult> {
    const { tokenInternalId, deviceModelId } = solanaTokenContextInput;

    if (!tokenInternalId) {
      return {
        type: SolanaContextTypes.ERROR,
        error: new Error(
          "[ContextModule] SolanaTokenContextLoader: tokenInternalId is missing",
        ),
      };
    }

    const payload = await this.dataSource.getTokenInfosPayload({
      tokenInternalId,
    });

    const certificate: PkiCertificate | undefined =
      await this._certificateLoader.loadCertificate({
        keyId: "token_metadata_key",
        keyUsage: KeyUsage.CoinMeta,
        targetDevice: deviceModelId,
      });

    return payload.caseOf({
      Left: (error): SolanaTokenContextResult => ({
        type: SolanaContextTypes.ERROR,
        error,
      }),
      Right: (value): SolanaTokenContextResult => ({
        type: SolanaContextTypes.SOLANA_TOKEN,
        payload: this.pluckTokenData(value),
        certificate,
      }),
    });
  }

  private pluckTokenData(tokenData: TokenDataResponse): SolanaTokenData {
    const signatureKind = this.config.cal.mode || "prod";
    return {
      solanaTokenDescriptor: {
        data: tokenData.descriptor.data,
        signature: tokenData.descriptor.signatures[signatureKind],
      },
    };
  }
}
