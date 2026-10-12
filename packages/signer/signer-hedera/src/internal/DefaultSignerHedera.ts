import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfigOptions } from "@api/model/AppConfigOptions";
import { type PublicKeyOptions } from "@api/model/PublicKeyOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type SignerHedera } from "@api/SignerHedera";
import { makeContainer } from "@internal/di";
import { configTypes } from "@internal/use-cases/config/di/configTypes";
import { type GetAppConfigUseCase } from "@internal/use-cases/config/GetAppConfigUseCase";
import { publicKeyTypes } from "@internal/use-cases/publickey/di/publicKeyTypes";
import { type GetPublicKeyUseCase } from "@internal/use-cases/publickey/GetPublicKeyUseCase";
import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { type SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

type DefaultSignerHederaConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerHedera implements SignerHedera {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerHederaConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

  getAppConfig(options?: AppConfigOptions): GetAppConfigDAReturnType {
    return this._container
      .get<GetAppConfigUseCase>(configTypes.GetAppConfigUseCase)
      .execute(options);
  }

  getPublicKey(
    keyIndex: number,
    options?: PublicKeyOptions,
  ): GetPublicKeyDAReturnType {
    return this._container
      .get<GetPublicKeyUseCase>(publicKeyTypes.GetPublicKeyUseCase)
      .execute(keyIndex, options);
  }

  signTransaction(
    keyIndex: number,
    transactionBody: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(transactionTypes.SignTransactionUseCase)
      .execute(keyIndex, transactionBody, options);
  }
}
