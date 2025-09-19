import { inject, injectable } from "inversify";

import { ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import * as TrustedNameDataSource from "@/trusted-name/data/TrustedNameDataSource";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";

type TrustedNameFieldInput = {
  chainId: number;
  address: string;
  challenge: string;
  types: string[];
  sources: string[];
};

@injectable()
export class TrustedNameContextFieldLoader
  implements ContextFieldLoader<TrustedNameFieldInput>
{
  constructor(
    @inject(trustedNameTypes.TrustedNameDataSource)
    private _dataSource: TrustedNameDataSource.TrustedNameDataSource,
  ) {}

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType,
  ): input is TrustedNameFieldInput {
    return (
      expectedType === ClearSignContextType.TRUSTED_NAME &&
      typeof input === "object" &&
      input !== null &&
      "chainId" in input &&
      "address" in input &&
      "challenge" in input &&
      "types" in input &&
      "sources" in input
    );
  }

  async loadField(input: TrustedNameFieldInput): Promise<ClearSignContext> {
    const payload = await this._dataSource.getTrustedNamePayload({
      chainId: input.chainId,
      address: input.address,
      challenge: input.challenge,
      types: input.types,
      sources: input.sources,
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
}
