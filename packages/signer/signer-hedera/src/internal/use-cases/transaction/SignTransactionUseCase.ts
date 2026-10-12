import { inject, injectable } from "inversify";

import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import {
  assertValidKeyIndex,
  assertValidTransactionLength,
} from "@internal/app-binder/command/utils/apduUtils";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

@injectable()
export class SignTransactionUseCase {
  private readonly _appBinder: HederaAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: HederaAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    keyIndex: number,
    transactionBody: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    assertValidKeyIndex(keyIndex);
    assertValidTransactionLength(transactionBody);
    return this._appBinder.signTransaction({
      keyIndex,
      transactionBody,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
