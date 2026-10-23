import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetExtendedPublicKeyDAReturnType } from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type LegacyCreateTransactionArg } from "@api/model/CreateTransactionArg";
import { type ExtendedPublicKeyOptions } from "@api/model/ExtendedPublicKeyOptions";
import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type SignerBtcLegacy } from "@api/SignerBtcLegacy";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";
import { makeContainer } from "@internal/di";
import { type GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { type GetExtendedPublicKeyUseCase } from "@internal/use-cases/address/GetExtendedPublicKeyUseCase";
import { type SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

type DefaultSignerBtcLegacyConstructorArgs<ErrorCodes extends string> = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  profile: LegacyCoinProfile<ErrorCodes>;
};

export class DefaultSignerBtcLegacy<ErrorCodes extends string>
  implements SignerBtcLegacy<ErrorCodes>
{
  private readonly _container: Container;

  constructor({
    dmk,
    sessionId,
    profile,
  }: DefaultSignerBtcLegacyConstructorArgs<ErrorCodes>) {
    this._container = makeContainer({ dmk, sessionId, profile });
  }

  getAddress(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType<ErrorCodes> {
    return this._container
      .get<GetAddressUseCase<ErrorCodes>>(btcLegacyTypes.GetAddressUseCase)
      .execute(derivationPath, options);
  }

  getExtendedPublicKey(
    derivationPath: string,
    options?: ExtendedPublicKeyOptions,
  ): GetExtendedPublicKeyDAReturnType<ErrorCodes> {
    return this._container
      .get<
        GetExtendedPublicKeyUseCase<ErrorCodes>
      >(btcLegacyTypes.GetExtendedPublicKeyUseCase)
      .execute(derivationPath, options);
  }

  signTransaction(
    transaction: LegacyCreateTransactionArg,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType<ErrorCodes> {
    return this._container
      .get<
        SignTransactionUseCase<ErrorCodes>
      >(btcLegacyTypes.SignTransactionUseCase)
      .execute(transaction, options);
  }
}
