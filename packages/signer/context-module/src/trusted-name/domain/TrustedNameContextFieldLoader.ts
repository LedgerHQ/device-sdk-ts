import { inject, injectable } from "inversify";

import {
  ContextFieldLoader,
  ContextFieldLoaderKind,
} from "@/shared/domain/ContextFieldLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import * as TrustedNameDataSource from "@/trusted-name/data/TrustedNameDataSource";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";

type TrustedNameFieldInput = {
  kind: ContextFieldLoaderKind.TRUSTED_NAME;
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

  canHandle(field: unknown): field is TrustedNameFieldInput {
    return (
      typeof field === "object" &&
      field !== null &&
      "kind" in field &&
      field.kind === ContextFieldLoaderKind.TRUSTED_NAME &&
      "chainId" in field &&
      "address" in field &&
      "challenge" in field &&
      "types" in field &&
      "sources" in field
    );
  }

  async loadField(field: TrustedNameFieldInput): Promise<ClearSignContext> {
    const payload = await this._dataSource.getTrustedNamePayload({
      chainId: field.chainId,
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
}
