import { type ContextModule } from "@ledgerhq/context-module";
import { DeviceSdk, type DeviceSessionId } from "@ledgerhq/device-sdk-core";
import { SendCommandInAppDeviceAction } from "@ledgerhq/device-sdk-core";
import { UserInteractionRequired } from "@ledgerhq/device-sdk-core";
import { inject, injectable } from "inversify";

import { GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { TypedData } from "@api/model/TypedData";
import { SignTypedDataDeviceAction } from "@internal/app-binder/device-action/SignTypedData/SignTypedDataDeviceAction";
import { externalTypes } from "@internal/externalTypes";
import { TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

import { GetAddressCommand } from "./command/GetAddressCommand";

@injectable()
export class EthAppBinder {
  private _sdk: DeviceSdk;
  private _contextModule: ContextModule;
  private _sessionId: DeviceSessionId;

  constructor(
    @inject(externalTypes.Sdk) sdk: DeviceSdk,
    @inject(externalTypes.ContextModule) contextModule: ContextModule,
    @inject(externalTypes.SessionId) sessionId: DeviceSessionId,
  ) {
    this._sdk = sdk;
    this._contextModule = contextModule;
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

  signTypedData(args: {
    derivationPath: string;
    parser: TypedDataParserService;
    data: TypedData;
  }): SignTypedDataDAReturnType {
    return this._sdk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SignTypedDataDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          data: args.data,
          parser: args.parser,
          contextModule: this._contextModule,
        },
      }),
    });
  }
}
