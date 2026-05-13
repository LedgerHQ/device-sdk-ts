import { type ContextModule } from "@ledgerhq/context-module";
import {
  DeviceManagementKit,
  type DeviceSessionId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { CallTaskInAppDeviceAction } from "@ledgerhq/device-management-kit";
import { UserInteractionRequired } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type EditExternalAddressDAReturnType } from "@api/app-binder/EditExternalAddressDeviceActionTypes";
import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type ProvideContactDAReturnType } from "@api/app-binder/ProvideContactDeviceActionTypes";
import { type ProvideLedgerAccountDAReturnType } from "@api/app-binder/ProvideLedgerAccountDeviceActionTypes";
import { type RegisterExternalAddressDAReturnType } from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import { type RegisterLedgerAccountDAReturnType } from "@api/app-binder/RegisterLedgerAccountDeviceActionTypes";
import { SignDelegationAuthorizationDAReturnType } from "@api/app-binder/SignDelegationAuthorizationTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { VerifySafeAddressDAReturnType } from "@api/app-binder/VerifySafeAddressDeviceActionTypes";
import { type EditExternalAddressArgs } from "@api/model/EditExternalAddressArgs";
import { type ProvideContactArgs } from "@api/model/ProvideContactArgs";
import { type ProvideLedgerAccountArgs } from "@api/model/ProvideLedgerAccountArgs";
import { type RegisterExternalAddressArgs } from "@api/model/RegisterExternalAddressArgs";
import { type RegisterLedgerAccountArgs } from "@api/model/RegisterLedgerAccountArgs";
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

import { SignTransactionDeviceAction } from "./device-action/SignTransaction/SignTransactionDeviceAction";
import { VerifySafeAddressDeviceAction } from "./device-action/VerifySafeAddress/VerifySafeAddress";
import { SendEditIdentifierTask } from "./task/SendEditIdentifierTask";
import { SendGetAddressTask } from "./task/SendGetAddressTask";
import { SendProvideContactTask } from "./task/SendProvideContactTask";
import { SendProvideLedgerAccountTask } from "./task/SendProvideLedgerAccountTask";
import { SendRegisterIdentityTask } from "./task/SendRegisterIdentityTask";
import { SendRegisterLedgerAccountTask } from "./task/SendRegisterLedgerAccountTask";
import { SendSignAuthorizationDelegationTask } from "./task/SendSignAuthorizationDelegationTask";
import { APP_NAME } from "./constants";

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
    chainId?: number;
  }): GetAddressDAReturnType {
    const taskLogger = this.dmkLoggerFactory("SendGetAddressTask");
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendGetAddressTask(internalApi, {
              contextModule: this.contextModule,
              derivationPath: args.derivationPath,
              checkOnDevice: args.checkOnDevice,
              returnChainCode: args.returnChainCode,
              chainId: args.chainId,
              loggerFactory: this.dmkLoggerFactory,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: args.checkOnDevice
            ? UserInteractionRequired.VerifyAddress
            : UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
        logger: taskLogger,
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
          appName: APP_NAME,
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

  registerExternalAddress(
    args: RegisterExternalAddressArgs,
  ): RegisterExternalAddressDAReturnType {
    const taskLogger = this.dmkLoggerFactory("SendRegisterIdentityTask");
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendRegisterIdentityTask(internalApi, {
              ...args,
              logger: taskLogger,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.RegisterWallet,
          skipOpenApp: false,
        },
        logger: this.dmkLoggerFactory("SendRegisterIdentityTask"),
      }),
    });
  }

  // NOTE: Contacts metadata (registerLedgerAccount / provideContact /
  // provideLedgerAccount and siblings below) is currently pushed
  // out-of-band by callers — see the SignerEth JSDoc for the
  // orchestration contract. The planned shape is a ContactsContextLoader
  // registered with DefaultContextModule + new
  // ClearSignContextType.CONTACT_* branches in ProvideContextTask,
  // mirroring how ENS / ERC-7730 / web3-check are loaded today. Tracked:
  // <TICKET-ID>.
  registerLedgerAccount(
    args: RegisterLedgerAccountArgs,
  ): RegisterLedgerAccountDAReturnType {
    const taskLogger = this.dmkLoggerFactory("SendRegisterLedgerAccountTask");
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendRegisterLedgerAccountTask(internalApi, {
              ...args,
              logger: taskLogger,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.RegisterWallet,
          skipOpenApp: false,
        },
        logger: this.dmkLoggerFactory("SendRegisterLedgerAccountTask"),
      }),
    });
  }

  editExternalAddress(
    args: EditExternalAddressArgs,
  ): EditExternalAddressDAReturnType {
    const taskLogger = this.dmkLoggerFactory("SendEditIdentifierTask");
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendEditIdentifierTask(internalApi, {
              ...args,
              logger: taskLogger,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.RegisterWallet,
          skipOpenApp: false,
        },
        logger: this.dmkLoggerFactory("SendEditIdentifierTask"),
      }),
    });
  }

  provideContact(args: ProvideContactArgs): ProvideContactDAReturnType {
    const taskLogger = this.dmkLoggerFactory("SendProvideContactTask");
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendProvideContactTask(internalApi, {
              ...args,
              logger: taskLogger,
            }).run(),
          appName: APP_NAME,
          // Silent op — firmware trusts the HMAC chain authorised at
          // Register time and returns 0x9000 with no user prompt.
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: false,
        },
        logger: this.dmkLoggerFactory("SendProvideContactTask"),
      }),
    });
  }

  provideLedgerAccount(
    args: ProvideLedgerAccountArgs,
  ): ProvideLedgerAccountDAReturnType {
    const taskLogger = this.dmkLoggerFactory("SendProvideLedgerAccountTask");
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendProvideLedgerAccountTask(internalApi, {
              ...args,
              logger: taskLogger,
            }).run(),
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: false,
        },
        logger: this.dmkLoggerFactory("SendProvideLedgerAccountTask"),
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
          appName: APP_NAME,
          requiredUserInteraction:
            UserInteractionRequired.SignDelegationAuthorization,
          skipOpenApp: false,
        },
        logger: this.dmkLoggerFactory("SendSignAuthorizationDelegationTask"),
      }),
    });
  }
}
