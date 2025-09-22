import { inject, injectable } from "inversify";

import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import type { TrustedNameDataSource } from "@/trusted-name/data/TrustedNameDataSource";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";

export type TrustedNameContextInput = {
  chainId: number;
  domain: string;
  challenge: string;
};

@injectable()
export class TrustedNameContextLoader
  implements ContextLoader<TrustedNameContextInput>
{
  private _dataSource: TrustedNameDataSource;

  constructor(
    @inject(trustedNameTypes.TrustedNameDataSource)
    dataSource: TrustedNameDataSource,
  ) {
    this._dataSource = dataSource;
  }

  canHandle(input: unknown): input is TrustedNameContextInput {
    return (
      typeof input === "object" &&
      input !== null &&
      "chainId" in input &&
      "domain" in input &&
      "challenge" in input &&
      typeof input.chainId === "number" &&
      typeof input.domain === "string" &&
      input.domain.length > 0 &&
      typeof input.challenge === "string" &&
      input.challenge.length > 0
    );
  }

  async load(input: TrustedNameContextInput): Promise<ClearSignContext[]> {
    const { chainId, domain, challenge } = input;

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
