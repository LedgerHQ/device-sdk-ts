import { inject, injectable } from "inversify";

import {
  ContextFieldLoader,
  ContextFieldLoaderKind,
} from "@/shared/domain/ContextFieldLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { TransactionFieldContext } from "@/shared/model/TransactionFieldContext";
import * as TrustedNameDataSource from "@/trusted-name/data/TrustedNameDataSource";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";

@injectable()
export class TrustedNameContextFieldLoader
  implements ContextFieldLoader<ContextFieldLoaderKind.TRUSTED_NAME>
{
  kind: ContextFieldLoaderKind.TRUSTED_NAME =
    ContextFieldLoaderKind.TRUSTED_NAME;

  constructor(
    @inject(trustedNameTypes.TrustedNameDataSource)
    private _dataSource: TrustedNameDataSource.TrustedNameDataSource,
  ) {}

  async loadField(
    field: TransactionFieldContext<ContextFieldLoaderKind.TRUSTED_NAME>,
  ): Promise<ClearSignContext> {
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
