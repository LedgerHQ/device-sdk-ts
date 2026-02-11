import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";
import { type SignerCanton } from "@api/SignerCanton";
import { makeContainer } from "@internal/di";
import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { configTypes } from "@internal/use-cases/config/di/configTypes";
import { type GetAppConfigUseCase } from "@internal/use-cases/config/GetAppConfigUseCase";
import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { addressTypes } from "@internal/use-cases/address/di/addressTypes";
import { type GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { type SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { messageTypes } from "@internal/use-cases/message/di/messageTypes";
import { type SignMessageUseCase } from "@internal/use-cases/message/SignMessageUseCase";

type DefaultSignerCantonConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerCanton implements SignerCanton {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerCantonConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

  getAppConfig(): GetAppConfigDAReturnType {
    return this._container
      .get<GetAppConfigUseCase>(configTypes.GetAppConfigUseCase)
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

  signMessage(
    derivationPath: string,
    message: string | Uint8Array,
  ): SignMessageDAReturnType {
    return this._container
      .get<SignMessageUseCase>(messageTypes.SignMessageUseCase)
      .execute(derivationPath, message);
  }
}
