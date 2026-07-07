import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type SignerTrx } from "@api/SignerTrx";
import { makeContainer } from "@internal/di";
import { addressTypes } from "@internal/use-cases/address/di/addressTypes";
import { type GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { appConfigurationTypes } from "@internal/use-cases/app-configuration/di/appConfigurationTypes";
import { type GetAppConfigurationUseCase } from "@internal/use-cases/app-configuration/GetAppConfigurationUseCase";
import { messageTypes } from "@internal/use-cases/message/di/messageTypes";
import { type SignPersonalMessageUseCase } from "@internal/use-cases/message/SignPersonalMessageUseCase";
import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { type SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

type DefaultSignerTrxConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerTrx implements SignerTrx {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerTrxConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
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

  signPersonalMessage(
    derivationPath: string,
    message: string | Uint8Array,
    options?: MessageOptions,
  ): SignPersonalMessageDAReturnType {
    return this._container
      .get<SignPersonalMessageUseCase>(messageTypes.SignPersonalMessageUseCase)
      .execute(derivationPath, message, options);
  }

  getAppConfiguration(): GetAppConfigurationDAReturnType {
    return this._container
      .get<GetAppConfigurationUseCase>(
        appConfigurationTypes.GetAppConfigurationUseCase,
      )
      .execute();
  }
}
