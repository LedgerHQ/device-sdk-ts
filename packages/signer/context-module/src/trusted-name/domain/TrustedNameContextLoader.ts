import { inject, injectable } from "inversify";

import { pkiTypes } from "@/pki/di/pkiDiTypes";
import { KeyUsage } from "@/pki/domain/model/KeyUsage";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import {
  TransactionContext,
  TransactionFieldContext,
} from "@/shared/model/TransactionContext";
import type { TrustedNameDataSource } from "@/trusted-name/data/TrustedNameDataSource";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";

@injectable()
export class TrustedNameContextLoader implements ContextLoader {
  private _dataSource: TrustedNameDataSource;
  private _certificateLoader: PkiCertificateLoader;

  constructor(
    @inject(trustedNameTypes.TrustedNameDataSource)
    dataSource: TrustedNameDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    certificateLoader: PkiCertificateLoader,
  ) {
    this._dataSource = dataSource;
    this._certificateLoader = certificateLoader;
  }

  async load(
    transactionContext: TransactionContext,
  ): Promise<ClearSignContext[]> {
    const { domain, challenge } = transactionContext;

    if (!domain || !challenge) {
      return [];
    }

    if (!this.isDomainValid(domain)) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: new Error("[ContextModule] TrustedNameLoader: invalid domain"),
        },
      ];
    }

    const payload = await this._dataSource.getDomainNamePayload({
      domain: domain,
      challenge: challenge,
    });

    //Try to fetch Nano PKI certificate
    const certificate = await this._certificateLoader.loadCertificate({
      targetDevice: "flex",
      keyUsage: KeyUsage.TrustedName,
    });

    return [
      payload.caseOf({
        Left: (error): ClearSignContext => ({
          type: ClearSignContextType.ERROR,
          error: error,
        }),
        Right: (value): ClearSignContext => ({
          type: ClearSignContextType.TRUSTED_NAME,
          payload: value,
          certificate: certificate ? certificate : undefined,
        }),
      }),
    ];
  }

  async loadField(
    field: TransactionFieldContext,
  ): Promise<ClearSignContext | null> {
    if (field.type !== ClearSignContextType.TRUSTED_NAME) {
      return null;
    }
    const payload = await this._dataSource.getTrustedNamePayload({
      address: field.address,
      challenge: field.challenge,
      types: field.types,
      sources: field.sources,
    });
    return payload.caseOf({
      Left: (error): ClearSignContext => ({
        type: ClearSignContextType.ERROR,
        error,
      }),
      Right: (value): ClearSignContext => ({
        type: ClearSignContextType.TRUSTED_NAME,
        payload: value,
      }),
    });
  }

  private isDomainValid(domain: string) {
    const lengthIsValid = domain.length > 0 && Number(domain.length) < 30;
    const containsOnlyValidChars = new RegExp("^[a-zA-Z0-9\\-\\_\\.]+$").test(
      domain,
    );

    return lengthIsValid && containsOnlyValidChars;
  }
}
