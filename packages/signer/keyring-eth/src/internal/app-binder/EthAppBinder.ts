import { type ContextModule } from "@ledgerhq/context-module";
import { DeviceSdk, type DeviceSessionId } from "@ledgerhq/device-sdk-core";
import { SendCommandInAppDeviceAction } from "@ledgerhq/device-sdk-core";
import { UserInteractionRequired } from "@ledgerhq/device-sdk-core";
import { inject, injectable } from "inversify";

import { GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { Transaction } from "@api/model/Transaction";
import { TransactionOptions } from "@api/model/TransactionOptions";
import { TypedData } from "@api/model/TypedData";
import { SignTypedDataDeviceAction } from "@internal/app-binder/device-action/SignTypedData/SignTypedDataDeviceAction";
import { externalTypes } from "@internal/externalTypes";
import { transactionTypes } from "@internal/transaction/di/transactionTypes";
import { TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

import { GetAddressCommand } from "./command/GetAddressCommand";
import { SignPersonalMessageDeviceAction } from "./device-action/SignPersonalMessage/SignPersonalMessageDeviceAction";
import { SignTransactionDeviceAction } from "./device-action/SignTransaction/SignTransactionDeviceAction";

@injectable()
export class EthAppBinder {
  private _sdk: DeviceSdk;
  private _contextModule: ContextModule;
  private _mapper: TransactionMapperService;
  private _sessionId: DeviceSessionId;

  constructor(
    @inject(externalTypes.Sdk) sdk: DeviceSdk,
    @inject(externalTypes.ContextModule) contextModule: ContextModule,
    @inject(transactionTypes.TransactionMapperService)
    mapper: TransactionMapperService,
    @inject(externalTypes.SessionId) sessionId: DeviceSessionId,
  ) {
    this._sdk = sdk;
    this._contextModule = contextModule;
    this._mapper = mapper;
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

  signPersonalMessage(args: {
    derivationPath: string;
    message: string;
  }): SignPersonalMessageDAReturnType {
    return this._sdk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SignPersonalMessageDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          message: args.message,
        },
      }),
    });
  }

  signTransaction(args: {
    derivationPath: string;
    transaction: Transaction;
    options?: TransactionOptions;
  }): SignTransactionDAReturnType {
    return this._sdk.executeDeviceAction({
      sessionId: this._sessionId,
      deviceAction: new SignTransactionDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          transaction: args.transaction,
          mapper: this._mapper,
          contextModule: this._contextModule,
          options: args.options ?? {},
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
