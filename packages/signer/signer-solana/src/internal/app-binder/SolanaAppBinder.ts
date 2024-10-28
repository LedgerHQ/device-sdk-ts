import {
  DeviceSdk,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { inject } from "inversify";

import { GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { Transaction } from "@api/model/Transaction";
import { externalTypes } from "@internal/externalTypes";

export class SolanaAppBinder {
  constructor(
    @inject(externalTypes.Sdk) private _sdk: DeviceSdk,
    @inject(externalTypes.SessionId) private _sessionId: DeviceSessionId,
  ) {
    // FIXME: avoid lint error for now
    console.log(this._sdk);
    console.log(this._sessionId);
  }

  getAddress(_args: {
    derivationPath: string;
    checkOnDevice: boolean;
  }): GetAddressDAReturnType {
    return {} as GetAddressDAReturnType;
  }

  signTransaction(_args: {
    derivationPath: string;
    transaction: Transaction;
  }): SignTransactionDAReturnType {
    return {} as SignTransactionDAReturnType;
  }

  signMessage(_args: {
    derivationPath: string;
    message: string;
  }): SignMessageDAReturnType {
    return {} as SignMessageDAReturnType;
  }

  getAppConfiguration(): GetAppConfigurationDAReturnType {
    return {} as GetAppConfigurationDAReturnType;
  }
}
