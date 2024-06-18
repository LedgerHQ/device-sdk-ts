import { EthAppBinding } from "@eth/app-binding/EthAppBinding";
import { DeviceSdk } from "@ledgerhq/device-sdk-core";

import { ContextModule } from "@root/context-module/ContextModule";

import {
  Address,
  KeyringEth,
  Message,
  Options,
  Signature,
  Transaction,
} from "./KeyringEth";

export class DefaultKeyringEth implements KeyringEth {
  private _appBinding: EthAppBinding;
  private _contextModule: ContextModule;

  constructor(sdk: DeviceSdk) {
    this._appBinding = new EthAppBinding(sdk);
  }

  public signTransaction(
    _derivationPath: string,
    _transaction: Transaction,
    _options: Options,
  ): Promise<Signature> {
    return Promise.resolve("signature");
  }

  public signMessage(
    _derivationPath: string,
    _message: Message,
    _options: Options,
  ): Promise<Signature> {
    return Promise.resolve("signature");
  }

  public getAddress(
    _derivationPath: string,
    _options: Options,
  ): Promise<Address> {
    return Promise.resolve("response");
  }
}
