import {
  ClearSignContextType,
  isEthereumClearSignContextSuccess,
  type TransactionSubset,
} from "@ledgerhq/context-module";
import { sendProvideContactPayload } from "@ledgerhq/device-contacts-kit";
import {
  ByteArrayBuilder,
  type CommandErrorResult,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { type Either, Left, Right } from "purify-ts";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import { type EvmAddressBook } from "@api/model/EvmAddressBook";
import { StoreTransactionCommand } from "@internal/app-binder/command/StoreTransactionCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { buildExternalContactPayload } from "@internal/shared/utils/buildExternalContactPayload";

import { type ContextWithSubContexts } from "./BuildFullContextsTask";
import {
  ProvideContextTask,
  type ProvideContextTaskArgs,
} from "./ProvideContextTask";
import {
  SendCommandInChunksTask,
  type SendCommandInChunksTaskArgs,
} from "./SendCommandInChunksTask";

/**
 * Everything needed to look up the transaction recipient in the host address
 * book. The three travel together because none of them means anything alone.
 */
export type ExternalContactArgs = {
  readonly addressBook: EvmAddressBook;
  readonly subset: TransactionSubset;
  readonly appConfig: GetConfigCommandResponse;
};

export type ProvideTransactionContextsTaskArgs = {
  /**
   * The list of clear sign context with subcontexts callback to provide.
   */
  contexts: ContextWithSubContexts[];
  /**
   * The derivation path to provide.
   */
  derivationPath: string;
  /**
   * The serialized transaction to provide.
   * This parameter is optional in the case there is no transaction at all, for instance
   * if there is only a standalone calldata embedded in a message.
   */
  serializedTransaction?: Uint8Array;
  /**
   * Provide the contact matching the transaction recipient, ahead of the
   * contexts. Omitted where there is no transaction recipient to match against
   * — typed-data calldata, or a nested call inside a transaction.
   */
  externalContact?: ExternalContactArgs;
  /**
   * Logger factory for creating loggers with custom tags.
   */
  loggerFactory: (tag: string) => LoggerPublisherService;
};

export type ProvideTransactionContextsTaskResult = Either<
  CommandErrorResult<EthErrorCodes>,
  void
>;

/**
 * This task is responsible for providing the transaction context to the device.
 * It will send the subcontexts callbacks in order and finish with the context.
 */
export class ProvideTransactionContextsTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private _api: InternalApi,
    private _args: ProvideTransactionContextsTaskArgs,
    private _provideContextTaskFactory = (
      api: InternalApi,
      args: ProvideContextTaskArgs,
    ) => new ProvideContextTask(api, args),
    private _sendCommandInChunksTaskFactory = (
      api: InternalApi,
      args: SendCommandInChunksTaskArgs<unknown>,
    ) => new SendCommandInChunksTask(api, args),
  ) {
    this._logger = _args.loggerFactory("ProvideTransactionContextsTask");
  }

  async run(): Promise<ProvideTransactionContextsTaskResult> {
    this._logger.debug("[run] Starting ProvideTransactionContextsTask", {
      data: {
        derivationPath: this._args.derivationPath,
        contextTypes: this._args.contexts.map((c) => c.context.type),
        subcontextCounts: this._args.contexts.map(
          (c) => c.subcontextCallbacks.length,
        ),
        transactionLength: this._args.serializedTransaction?.length,
      },
    });

    let transactionInfoProvided = false;
    const contactProvided = await this._provideExternalContact();

    for (const { context, subcontextCallbacks } of this._args.contexts) {
      if (
        contactProvided &&
        context.type === ClearSignContextType.ETHEREUM_TRUSTED_NAME
      ) {
        // The user-chosen name wins: a trusted name (ENS) resolves the same
        // recipient the contact just decorated, so providing it would overwrite
        // the contact on the review screen.
        continue;
      }

      for (const callback of subcontextCallbacks) {
        const subcontext = await callback();

        if (subcontext.type === ClearSignContextType.ERROR) {
          // silently ignore error subcontexts
          continue;
        }

        if (!isEthereumClearSignContextSuccess(subcontext)) {
          // silently ignore non-Ethereum subcontexts
          continue;
        }

        // Don't fail immediately on subcontext errors because the main context may still be successful
        await this._provideContextTaskFactory(this._api, {
          context: subcontext,
          loggerFactory: this._args.loggerFactory,
        }).run();
      }

      if (
        context.type === ClearSignContextType.ETHEREUM_PROXY_INFO ||
        context.type === ClearSignContextType.ETHEREUM_TRUSTED_NAME
      ) {
        // In this specific case, the context is not valid as the challenge is not valid on the first call
        // the real data is provided in the subcontext callback
        continue;
      }

      if (
        !transactionInfoProvided &&
        this._args.serializedTransaction !== undefined &&
        context.type === ClearSignContextType.ETHEREUM_TRANSACTION_INFO
      ) {
        // Send the serialized transaction for the first TRANSACTION_INFO.
        // All other TRANSACTION_INFO contexts will be ignored as it will be for nested calldata.
        transactionInfoProvided = true;

        const paths = DerivationPathUtils.splitPath(this._args.derivationPath);
        const builder = new ByteArrayBuilder();
        builder.add8BitUIntToData(paths.length);
        paths.forEach((path) => {
          builder.add32BitUIntToData(path);
        });
        builder.addBufferToData(this._args.serializedTransaction);
        await this._sendCommandInChunksTaskFactory(this._api, {
          data: builder.build(),
          commandFactory: (args) =>
            new StoreTransactionCommand({
              serializedTransaction: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        }).run();
      }

      const res = await this._provideContextTaskFactory(this._api, {
        context,
        loggerFactory: this._args.loggerFactory,
      }).run();
      if (!isSuccessCommandResult(res)) {
        this._logger.error("[run] Failed to provide context", {
          data: { contextType: context.type, error: res.error },
        });
        return Left(res);
      }
    }

    this._logger.debug(
      "[run] ProvideTransactionContextsTask completed successfully",
    );
    return Right(void 0);
  }

  /**
   * Returns whether the device accepted a contact for the recipient, so the
   * caller knows to drop the trusted name it replaces.
   */
  private async _provideExternalContact(): Promise<boolean> {
    if (this._args.externalContact === undefined) {
      return false;
    }

    const payload = buildExternalContactPayload({
      ...this._args.externalContact,
      deviceState: this._api.getDeviceSessionState(),
    });
    if (payload === undefined) {
      return false;
    }

    const result = await sendProvideContactPayload(this._api, {
      payload,
      logger: this._logger,
    });

    if (!isSuccessCommandResult(result)) {
      // Warn, not error: a rejection is a routine outcome, not a fault. The
      // device answers 0x6982 for a proof made by another seed, and the host is
      // not required to filter its address book by seed, so this fires in normal
      // use. A contact only decorates the review screen, so the name is dropped
      // and the user signs against the raw address.
      this._logger.warn(
        "[provideExternalContact] Contact rejected, signing without it",
        {
          data: { error: result.error },
        },
      );
      return false;
    }

    return true;
  }
}
