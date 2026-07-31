import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignUpdateCallDAReturnType } from "@api/app-binder/SignUpdateCallDeviceActionTypes";
import {
  type AddressOptions,
  type CommonOptions,
  type SignerIcp,
  type TransactionOptions,
} from "@api/SignerIcp";
import { makeContainer } from "@internal/di";
import { addressTypes } from "@internal/use-cases/address/di/addressTypes";
import { type GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { configTypes } from "@internal/use-cases/config/di/configTypes";
import { type GetAppConfigurationUseCase } from "@internal/use-cases/config/GetAppConfigurationUseCase";
import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { type SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";
import { type SignUpdateCallUseCase } from "@internal/use-cases/transaction/SignUpdateCallUseCase";

type DefaultSignerIcpConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerIcp implements SignerIcp {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerIcpConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

  getAppConfiguration(): GetVersionDAReturnType {
    return this._container
      .get<GetAppConfigurationUseCase>(configTypes.GetAppConfigurationUseCase)
      .execute();
  }

  getAddress(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._container
      .get<GetAddressUseCase>(addressTypes.GetAddressUseCase)
      .execute(derivationPath, options);
  }

  signTransaction(
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(transactionTypes.SignTransactionUseCase)
      .execute(derivationPath, transaction, options);
  }

  signUpdateCall(
    derivationPath: string,
    callRequest: Uint8Array,
    readStateRequest: Uint8Array,
    options?: CommonOptions,
  ): SignUpdateCallDAReturnType {
    return this._container
      .get<SignUpdateCallUseCase>(transactionTypes.SignUpdateCallUseCase)
      .execute(derivationPath, callRequest, readStateRequest, options);
  }
}
