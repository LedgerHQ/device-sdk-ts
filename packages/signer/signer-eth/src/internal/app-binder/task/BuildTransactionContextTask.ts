import {
  type ClearSignContextSuccess,
  type ClearSignContextSuccessType,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  DeviceSessionStateType,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { gte } from "semver";

import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TransactionType } from "@api/model/TransactionType";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

import { type GenericContext } from "./ProvideTransactionGenericContextTask";

export type BuildTransactionTaskResult = {
  readonly clearSignContexts: ClearSignContextSuccess[] | GenericContext;
  readonly serializedTransaction: Uint8Array;
  readonly chainId: number;
  readonly transactionType: TransactionType;
};

export type BuildTransactionContextTaskArgs = {
  readonly contextModule: ContextModule;
  readonly mapper: TransactionMapperService;
  readonly transaction: Uint8Array;
  readonly options: TransactionOptions;
  readonly challenge: string | null;
};

export class BuildTransactionContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: BuildTransactionContextTaskArgs,
  ) {}

  async run(): Promise<BuildTransactionTaskResult> {
    const { contextModule, mapper, transaction, options, challenge } =
      this.args;
    const parsed = mapper.mapTransactionToSubset(transaction);
    parsed.ifLeft((err) => {
      throw err;
    });
    const { subset, serializedTransaction, type } = parsed.unsafeCoerce();

    if (!challenge) {
      return {
        clearSignContexts: [],
        serializedTransaction,
        chainId: subset.chainId,
        transactionType: type,
      };
    }

    const clearSignContexts = await contextModule.getContexts({
      challenge,
      domain: options.domain,
      ...subset,
    });

    // NOTE: we need to filter out the ENUM and ERROR types
    // ENUM are handled differently
    // ERROR are not handled at all for now
    const clearSignContextsSuccess: ClearSignContextSuccess<
      Exclude<ClearSignContextSuccessType, ClearSignContextType.ENUM>
    >[] = clearSignContexts.filter(
      (context) =>
        context.type !== ClearSignContextType.ERROR &&
        context.type !== ClearSignContextType.ENUM,
    );

    // Retrieve all ENUM contexts
    const transactionEnums: ClearSignContextSuccess<ClearSignContextType.ENUM>[] =
      clearSignContexts.filter(
        (context) => context.type === ClearSignContextType.ENUM,
      );

    let filteredContexts: ClearSignContextSuccess[] | GenericContext = [];
    const transactionInfo = clearSignContextsSuccess.find(
      (ctx) => ctx.type === ClearSignContextType.TRANSACTION_INFO,
    );
    // If the device does not support the generic parser,
    // we need to filter out the transaction info and transaction field description
    // as they are not supported by the device
    if (!this.supportsGenericParser() || transactionInfo === undefined) {
      filteredContexts = clearSignContextsSuccess.filter(
        (ctx) =>
          ctx.type !== ClearSignContextType.TRANSACTION_INFO &&
          ctx.type !== ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
      );
    } else {
      const transactionFields = clearSignContextsSuccess.filter(
        (ctx) =>
          ctx.type === ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
      );
      filteredContexts = {
        transactionInfo: transactionInfo.payload,
        transactionFields,
        transactionEnums,
      };
    }

    return {
      clearSignContexts: filteredContexts,
      serializedTransaction,
      chainId: subset.chainId,
      transactionType: type,
    };
  }

  private supportsGenericParser(): boolean {
    const deviceState = this.api.getDeviceSessionState();
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return false;
    }
    if (deviceState.currentApp.name !== "Ethereum") {
      return false;
    }
    return gte(deviceState.currentApp.version, "1.14.0");
  }
}
