import { inject, injectable } from "inversify";

import type { ForwardDomainDataSource } from "@/forward-domain/data/ForwardDomainDataSource";
import { forwardDomainTypes } from "@/forward-domain/di/forwardDomainTypes";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { TransactionContext } from "@/shared/model/TransactionContext";

@injectable()
export class ForwardDomainContextLoader implements ContextLoader {
  private _dataSource: ForwardDomainDataSource;

  constructor(
    @inject(forwardDomainTypes.ForwardDomainDataSource)
    dataSource: ForwardDomainDataSource,
  ) {
    this._dataSource = dataSource;
  }

  async load(
    transactionContext: TransactionContext,
  ): Promise<ClearSignContext[]> {
    const { domain, challenge } = transactionContext;

    if (!domain) {
      return [];
    }

    if (!this.isDomainValid(domain)) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] ForwardDomainLoader: invalid domain",
          ),
        },
      ];
    }

    const payload = await this._dataSource.getDomainNamePayload({
      domain: domain,
      challenge: challenge,
    });

    return [
      payload.caseOf({
        Left: (error): ClearSignContext => ({
          type: ClearSignContextType.ERROR,
          error: error,
        }),
        Right: (value): ClearSignContext => ({
          type: ClearSignContextType.DOMAIN_NAME,
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
