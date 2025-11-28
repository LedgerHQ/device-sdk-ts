import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { PkiCertificate } from "@/pki/model/PkiCertificate";
import { ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import {
  SolanaContextTypes,
  SolanaTokenContextResult,
  SolanaTokenData,
} from "@/shared/model/SolanaContextTypes";
import { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";
import {
  type SolanaTokenDataSource,
  type TokenDataResponse,
} from "@/solanaToken/data/SolanaTokenDataSource";
import { solanaTokenTypes } from "@/solanaToken/di/solanaTokenTypes";

type SolanaTokenFieldInput = SolanaTransactionContext & {
  deviceModelId: DeviceModelId;
  tokenInternalId: string;
};

@injectable()
export class SolanaTokenContextLoader
  implements
    ContextFieldLoader<
      SolanaTokenFieldInput,
      SolanaContextTypes,
      SolanaTokenContextResult
    >
{
  constructor(
    @inject(solanaTokenTypes.SolanaTokenDataSource)
    private readonly dataSource: SolanaTokenDataSource,
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
  ) {}

  public canHandle(
    field: unknown,
    expectedType: SolanaContextTypes,
  ): field is SolanaTokenFieldInput {
    if (expectedType !== SolanaContextTypes.SOLANA_TOKEN) {
      return false;
    }

    if (
      typeof field !== "object" ||
      field === null ||
      !("tokenInternalId" in field)
    ) {
      return false;
    }

    const tokenInternalId = (field as { tokenInternalId: unknown })
      .tokenInternalId;

    return typeof tokenInternalId === "string" && tokenInternalId.length > 0;
  }

  public async loadField(
    solanaTokenContextInput: SolanaTokenFieldInput,
  ): Promise<SolanaTokenContextResult> {
    const { tokenInternalId, deviceModelId } = solanaTokenContextInput;

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
