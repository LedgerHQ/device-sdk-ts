import { DeviceSdk } from "@ledgerhq/device-sdk-core";

import { GetAddressCommand } from "./commands/GetAddressCommand";

export class EthAppBinding {
  private _sdk: DeviceSdk;

  constructor(sdk: DeviceSdk) {
    this._sdk = sdk;
  }

  public getAddress(
    derivationPath: string,
    options: { sessionId: string },
  ): Promise<any> {
    const command = new GetAddressCommand({ derivationPath });
    return this._sdk.sendCommand({ sessionId: options.sessionId, command });
  }
}
