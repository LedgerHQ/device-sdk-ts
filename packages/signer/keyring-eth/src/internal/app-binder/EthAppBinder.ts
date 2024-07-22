import { DeviceSdk, type DeviceSessionId } from "@ledgerhq/device-sdk-core";
import { inject, injectable } from "inversify";

import { Address } from "@api/model/Address";
import { externalTypes } from "@internal/externalTypes";

import {
  GetAddressCommand,
  GetAddressCommandResponse,
} from "./command/GetAddressCommand";

@injectable()
export class EthAppBinder {
  private _sdk: DeviceSdk;
  private _sessionId: DeviceSessionId;

  constructor(
    @inject(externalTypes.Sdk) sdk: DeviceSdk,
    @inject(externalTypes.SessionId) sessionId: DeviceSessionId,
  ) {
    this._sdk = sdk;
    this._sessionId = sessionId;
  }

  async getAddress(args: {
    derivationPath: string;
    checkOnDevice?: boolean;
    returnChainCode?: boolean;
  }): Promise<Address> {
    // TODO: replace with a DeviceAction
    const command = new GetAddressCommand(args);

    const response: GetAddressCommandResponse = await this._sdk.sendCommand({
      sessionId: this._sessionId,
      command,
    });

    return {
      address: response.address,
      publicKey: response.publicKey,
      chainCode: response.chainCode,
    };
  }
}
