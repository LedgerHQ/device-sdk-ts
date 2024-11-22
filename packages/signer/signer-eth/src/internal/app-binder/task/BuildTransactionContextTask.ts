import {
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  DeviceSessionStateType,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { gte } from "semver";

import { type Transaction, type TransactionType } from "@api/model/Transaction";
import { type TransactionOptions } from "@api/model/TransactionOptions";
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
  readonly transaction: Transaction;
  readonly options: TransactionOptions;
  readonly challenge: string;
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

    const clearSignContexts = await contextModule.getContexts({
      challenge,
      domain: options.domain,
      ...subset,
    });

    // TODO: for now we ignore the error contexts
    // as we consider that they are warnings and not blocking
    const clearSignContextsSuccess: ClearSignContextSuccess[] =
      clearSignContexts.filter(
        (context) => context.type !== ClearSignContextType.ERROR,
      );

    let filteredContexts: ClearSignContextSuccess[] | GenericContext = [];
    const transactionInfo = clearSignContextsSuccess.find(
      (ctx) => ctx.type === ClearSignContextType.TRANSACTION_INFO,
    );
    if (!this.supportsGenericParser() || transactionInfo === undefined) {
      filteredContexts = clearSignContextsSuccess.filter(
        (ctx) =>
          ctx.type !== ClearSignContextType.TRANSACTION_INFO &&
          ctx.type !== ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION &&
          ctx.type !== ClearSignContextType.ENUM,
      );
    } else {
      const transactionFields = clearSignContextsSuccess.filter(
        (ctx) =>
          ctx.type === ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION ||
          ctx.type === ClearSignContextType.ENUM,
      );
      filteredContexts = {
        transactionInfo: transactionInfo.payload,
        transactionFields,
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
    return gte(deviceState.currentApp.version, "1.13.0");
  }
}
