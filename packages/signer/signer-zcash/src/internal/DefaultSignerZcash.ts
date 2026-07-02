import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetFullViewingKeyDAReturnType } from "@api/app-binder/GetFullViewingKeyDeviceActionTypes";
import { type GetTrustedInputDAReturnType } from "@api/app-binder/GetTrustedInputActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignPcztTransactionDAReturnType } from "@api/app-binder/SignPcztTransactionDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type LegacyCreateTransactionArg } from "@api/model/CreateTransactionArg";
import { type FullViewingKeyOptions } from "@api/model/FullViewingKeyOptions";
import { type PcztTransaction } from "@api/model/PcztTransaction";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type SignerZcash } from "@api/SignerZcash";
import { makeContainer } from "@internal/di";
import { addressTypes } from "@internal/use-cases/address/di/addressTypes";
import { type GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { type GetFullViewingKeyUseCase } from "@internal/use-cases/address/GetFullViewingKeyUseCase";
import { configTypes } from "@internal/use-cases/config/di/configTypes";
import { type GetAppConfigUseCase } from "@internal/use-cases/config/GetAppConfigUseCase";
import { messageTypes } from "@internal/use-cases/message/di/messageTypes";
import { type SignMessageUseCase } from "@internal/use-cases/message/SignMessageUseCase";
import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { type GetTrustedInputUseCase } from "@internal/use-cases/transaction/GetTrustedInputUseCase";
import { type SignPcztTransactionUseCase } from "@internal/use-cases/transaction/SignPcztTransactionUseCase";
import { type SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

type DefaultSignerZcashConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerZcash implements SignerZcash {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerZcashConstructorArgs) {
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

  getFullViewingKey(
    derivationPath: string,
    options?: FullViewingKeyOptions,
  ): GetFullViewingKeyDAReturnType {
    return this._container
      .get<GetFullViewingKeyUseCase>(addressTypes.GetFullViewingKeyUseCase)
      .execute(derivationPath, options);
  }

  signTransaction(
    args: LegacyCreateTransactionArg,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(transactionTypes.SignTransactionUseCase)
      .execute(args, options);
  }

  signPcztTransaction(
    transaction: PcztTransaction,
    options?: TransactionOptions,
  ): SignPcztTransactionDAReturnType {
    return this._container
      .get<SignPcztTransactionUseCase>(
        transactionTypes.SignPcztTransactionUseCase,
      )
      .execute(transaction, options);
  }

  signMessage(
    derivationPath: string,
    message: string | Uint8Array,
  ): SignMessageDAReturnType {
    return this._container
      .get<SignMessageUseCase>(messageTypes.SignMessageUseCase)
      .execute(derivationPath, message);
  }

  getTrustedInput(
    transaction: Uint8Array,
    options?: { indexLookup?: number; skipOpenApp?: boolean },
  ): GetTrustedInputDAReturnType {
    return this._container
      .get<GetTrustedInputUseCase>(transactionTypes.GetTrustedInputUseCase)
      .execute(transaction, options);
  }
}
