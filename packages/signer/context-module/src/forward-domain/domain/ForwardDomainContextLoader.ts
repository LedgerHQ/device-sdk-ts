import { inject } from "inversify";

import type { ForwardDomainDataSource } from "@/forward-domain/data/ForwardDomainDataSource";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import { ClearSignContext } from "@/shared/model/ClearSignContext";
import { TransactionContext } from "@/shared/model/TransactionContext";

export class ForwardDomainContextLoader implements ContextLoader {
  private _dataSource: ForwardDomainDataSource;

  constructor(
    @inject("ForwardDomainDataSource") dataSource: ForwardDomainDataSource,
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

    if (!this.isDomainValid(domain as string)) {
      return [
        {
          type: "error",
          error: new Error(
            "[ContextModule] ForwardDomainLoader: invalid domain",
          ),
        },
      ];
    }

    const payload = await this._dataSource.getDomainNamePayload({
      domain: domain!,
      challenge: challenge,
    });

    return [
      payload.caseOf({
        Left: (error): ClearSignContext => ({
          type: "error",
          error: error,
        }),
        Right: (value): ClearSignContext => ({
          type: "domainName",
          payload: value,
        }),
      }),
    ];
  }

  // NOTE: duplicata of libs/domain-service/src/utils/index.ts
  private isDomainValid(domain: string) {
    const lengthIsValid = domain.length > 0 && Number(domain.length) < 30;
    const containsOnlyValidChars = new RegExp("^[a-zA-Z0-9\\-\\_\\.]+$").test(
      domain,
    );

    return lengthIsValid && containsOnlyValidChars;
  }
}
