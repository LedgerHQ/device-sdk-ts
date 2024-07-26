import { DeviceSdk, type DeviceSessionId } from "@ledgerhq/device-sdk-core";
import { SendCommandInAppDeviceAction } from "@ledgerhq/device-sdk-core";
import { UserInteractionRequired } from "@ledgerhq/device-sdk-core";
import { inject, injectable } from "inversify";

import { GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { externalTypes } from "@internal/externalTypes";

import { GetAddressCommand } from "./command/GetAddressCommand";

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

  getAddress(args: {
    derivationPath: string;
    checkOnDevice?: boolean;
    returnChainCode?: boolean;
  }): GetAddressDAReturnType {
    return this._sdk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAddressCommand(args),
          appName: "Ethereum",
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
        },
      }),
    });
  }
}
