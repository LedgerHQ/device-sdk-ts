import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetExtendedPublicKeyDAReturnType } from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type LegacyCreateTransactionArg } from "@api/model/CreateTransactionArg";
import { type ExtendedPublicKeyOptions } from "@api/model/ExtendedPublicKeyOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SignerBtcLegacy<ErrorCodes extends string> {
  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType<ErrorCodes>;

  getExtendedPublicKey: (
    derivationPath: string,
    options?: ExtendedPublicKeyOptions,
  ) => GetExtendedPublicKeyDAReturnType<ErrorCodes>;

  signTransaction: (
    transaction: LegacyCreateTransactionArg,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType<ErrorCodes>;
}
