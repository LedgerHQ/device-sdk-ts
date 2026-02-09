import { type ContextModule } from "@ledgerhq/context-module";
import {
  DeviceManagementKit,
  type DeviceSessionId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import {
  CallTaskInAppDeviceAction,
  SendCommandInAppDeviceAction,
} from "@ledgerhq/device-management-kit";
import { UserInteractionRequired } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { SignDelegationAuthorizationDAReturnType } from "@api/app-binder/SignDelegationAuthorizationTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { VerifySafeAddressDAReturnType } from "@api/app-binder/VerifySafeAddressDeviceActionTypes";
import { SafeAddressOptions } from "@api/model/SafeAddressOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TypedData } from "@api/model/TypedData";
import { SignTypedDataDeviceAction } from "@internal/app-binder/device-action/SignTypedData/SignTypedDataDeviceAction";
import { SendSignPersonalMessageTask } from "@internal/app-binder/task/SendSignPersonalMessageTask";
import { externalTypes } from "@internal/externalTypes";
import { transactionTypes } from "@internal/transaction/di/transactionTypes";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

import { GetAddressCommand } from "./command/GetAddressCommand";
import { SignTransactionDeviceAction } from "./device-action/SignTransaction/SignTransactionDeviceAction";
import { VerifySafeAddressDeviceAction } from "./device-action/VerifySafeAddress/VerifySafeAddress";
import { SendSignAuthorizationDelegationTask } from "./task/SendSignAuthorizationDelegationTask";

@injectable()
export class EthAppBinder {
  constructor(
    @inject(externalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(externalTypes.ContextModule) private contextModule: ContextModule,
    @inject(transactionTypes.TransactionMapperService)
    private mapper: TransactionMapperService,
    @inject(transactionTypes.TransactionParserService)
    private parser: TransactionParserService,
    @inject(externalTypes.SessionId) private sessionId: DeviceSessionId,
    @inject(externalTypes.DmkLoggerFactory)
    private dmkLoggerFactory: (tag: string) => LoggerPublisherService,
  ) {}

  getAddress(args: {
    derivationPath: string;
    checkOnDevice: boolean;
    returnChainCode: boolean;
    skipOpenApp: boolean;
  }): GetAddressDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetAddressCommand(args),
          appName: "Ethereum",
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
        logger: this.dmkLoggerFactory("GetAddressCommand"),
      }),
    });
  }

  verifySafeAddress(args: {
    safeContractAddress: string;
    options?: SafeAddressOptions;
  }): VerifySafeAddressDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new VerifySafeAddressDeviceAction({
        input: {
          safeContractAddress: args.safeContractAddress,
          contextModule: this.contextModule,
          options: args.options ?? { chainId: 1 },
        },
        loggerFactory: this.dmkLoggerFactory,
      }),
    });
  }

  signPersonalMessage(args: {
    derivationPath: string;
    message: string | Uint8Array;
    skipOpenApp: boolean;
  }): SignPersonalMessageDAReturnType {
    const taskLogger = this.dmkLoggerFactory("SendSignPersonalMessageTask");
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendSignPersonalMessageTask(internalApi, {
              ...args,
              logger: taskLogger,
            }).run(),
          appName: "Ethereum",
          requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
          skipOpenApp: args.skipOpenApp,
        },
        logger: this.dmkLoggerFactory("SendSignPersonalMessageTask"),
      }),
    });
  }

  signTransaction(args: {
    derivationPath: string;
    transaction: Uint8Array;
    options?: TransactionOptions;
  }): SignTransactionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SignTransactionDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          transaction: args.transaction,
          mapper: this.mapper,
          parser: this.parser,
          contextModule: this.contextModule,
          options: args.options ?? {},
        },
        loggerFactory: this.dmkLoggerFactory,
      }),
    });
  }

  signTypedData(args: {
    derivationPath: string;
    parser: TypedDataParserService;
    data: TypedData;
    skipOpenApp: boolean;
  }): SignTypedDataDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SignTypedDataDeviceAction({
        input: {
          derivationPath: args.derivationPath,
          data: args.data,
          parser: args.parser,
          transactionMapper: this.mapper,
          transactionParser: this.parser,
          contextModule: this.contextModule,
          skipOpenApp: args.skipOpenApp,
        },
        loggerFactory: this.dmkLoggerFactory,
      }),
    });
  }

  signDelegationAuthorization(args: {
    derivationPath: string;
    chainId: number;
    address: string;
    nonce: number;
  }): SignDelegationAuthorizationDAReturnType {
    const taskLogger = this.dmkLoggerFactory(
      "SendSignAuthorizationDelegationTask",
    );
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendSignAuthorizationDelegationTask(internalApi, {
              ...args,
              logger: taskLogger,
            }).run(),
          appName: "Ethereum",
          requiredUserInteraction:
            UserInteractionRequired.SignDelegationAuthorization,
          skipOpenApp: false,
        },
        logger: this.dmkLoggerFactory("SendSignAuthorizationDelegationTask"),
      }),
    });
  }
}
