import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  ByteArrayBuilder,
  type CommandErrorResult,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { type Either, Left, Right } from "purify-ts";

import { StoreTransactionCommand } from "@internal/app-binder/command/StoreTransactionCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

import { type ContextWithSubContexts } from "./BuildFullContextsTask";
import {
  ProvideContextTask,
  type ProvideContextTaskArgs,
} from "./ProvideContextTask";
import {
  SendCommandInChunksTask,
  type SendCommandInChunksTaskArgs,
} from "./SendCommandInChunksTask";

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
  ) {}

  async run(): Promise<ProvideTransactionContextsTaskResult> {
    let transactionInfoProvided = false;

    for (const { context, subcontextCallbacks } of this._args.contexts) {
      for (const callback of subcontextCallbacks) {
        const subcontext = await callback();

        if (subcontext.type === ClearSignContextType.ERROR) {
          // silently ignore error subcontexts
          continue;
        }

        // Don't fail immediately on subcontext errors because the main context may still be successful
        await this._provideContextTaskFactory(this._api, {
          context: subcontext,
        }).run();
      }

      if (context.type === ClearSignContextType.PROXY_INFO) {
        // In this specific case, the context is not valid as the challenge is not valid on the first call
        // the real data is provided in the subcontext callback
        continue;
      }

      if (
        !transactionInfoProvided &&
        this._args.serializedTransaction !== undefined &&
        context.type === ClearSignContextType.TRANSACTION_INFO
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
      }).run();
      if (!isSuccessCommandResult(res)) {
        return Left(res);
      }
    }

    return Right(void 0);
  }
}
