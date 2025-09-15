import { inject, injectable } from "inversify";

import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { TransactionContext } from "@/shared/model/TransactionContext";
import type { TrustedNameDataSource } from "@/trusted-name/data/TrustedNameDataSource";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";

@injectable()
export class TrustedNameContextLoader implements ContextLoader {
  private _dataSource: TrustedNameDataSource;

  constructor(
    @inject(trustedNameTypes.TrustedNameDataSource)
    dataSource: TrustedNameDataSource,
  ) {
    this._dataSource = dataSource;
  }

  async load(ctx: TransactionContext): Promise<ClearSignContext[]> {
    const { chainId, domain, challenge } = ctx;

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
      chainId,
      domain,
      challenge,
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
        }),
      }),
    ];
  }

  private isDomainValid(domain: string) {
    const lengthIsValid = domain.length > 0 && Number(domain.length) < 30;
    const containsOnlyValidChars = new RegExp("^[a-zA-Z0-9\\-\\_\\.]+$").test(
      domain,
    );

    return lengthIsValid && containsOnlyValidChars;
  }
}
