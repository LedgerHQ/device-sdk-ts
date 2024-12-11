import { type GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { type GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { type GetWalletIdDAReturnType } from "@api/app-binder/GetWalletIdDeviceActionTypes";
import { type SignDelegateDAReturnType } from "@api/app-binder/SignDelegateDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type DeviceActionOptions } from "@api/model/DeviceActionOptions";
import { type SignDelegateTaskArgs } from "@internal/app-binder/task/SignDelegateTask";
import { type SignMessageTaskArgs } from "@internal/app-binder/task/SignMessageTask";
import { type SignTransactionTaskArgs } from "@internal/app-binder/task/SignTransactionTask";

export interface SignerNear {
  getWalletId(
    derivationPath: string,
    options: DeviceActionOptions,
  ): GetWalletIdDAReturnType;
  getPublicKey(
    derivationPath: string,
    options: AddressOptions & DeviceActionOptions,
  ): GetPublicKeyDAReturnType;
  getVersion(options: DeviceActionOptions): GetVersionDAReturnType;
  signMessage(
    derivationPath: string,
    options: Omit<SignMessageTaskArgs, "derivationPath"> & DeviceActionOptions,
  ): SignMessageDAReturnType;
  signTransaction(
    derivationPath: string,
    args: Omit<SignTransactionTaskArgs, "derivationPath"> & DeviceActionOptions,
  ): SignTransactionDAReturnType;
  signDelegate(
    derivationPath: string,
    args: Omit<SignDelegateTaskArgs, "derivationPath"> & DeviceActionOptions,
  ): SignDelegateDAReturnType;
}
