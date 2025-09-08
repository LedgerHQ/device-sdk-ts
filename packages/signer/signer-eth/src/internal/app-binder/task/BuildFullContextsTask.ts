import {
  type ClearSignContext,
  ClearSignContextReferenceType,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  type TransactionSubset,
} from "@ledgerhq/context-module";
import {
  type DeviceModelId,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import { type ClearSigningType } from "@api/model/ClearSigningType";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import {
  BuildBaseContexts,
  type BuildBaseContextsArgs,
} from "./BuildBaseContexts";
import {
  BuildSubcontextsTask,
  type BuildSubcontextsTaskArgs,
} from "./BuildSubcontextsTask";
import {
  ParseNestedTransactionTask,
  type ParseNestedTransactionTaskArgs,
} from "./ParseNestedTransactionTask";

export type BuildFullContextsTaskResult = {
  readonly clearSignContexts: ContextWithSubContexts[];
  readonly clearSigningType: ClearSigningType;
};

export type BuildFullContextsTaskArgs = {
  readonly contextModule: ContextModule;
  readonly mapper: TransactionMapperService;
  readonly parser: TransactionParserService;
  readonly options: TransactionOptions;
  readonly appConfig: GetConfigCommandResponse;
  readonly derivationPath: string;
  readonly subset: TransactionSubset;
  readonly deviceModelId: DeviceModelId;
  readonly transaction?: Uint8Array;
};

export type ContextWithSubContexts = {
  context: ClearSignContextSuccess;
  subcontextCallbacks: (() => Promise<ClearSignContext>)[];
};

export class BuildFullContextsTask {
  constructor(
    private readonly _api: InternalApi,
    private readonly _args: BuildFullContextsTaskArgs,
    private readonly _buildSubcontextsTaskFactory = (
      api: InternalApi,
      args: BuildSubcontextsTaskArgs,
    ) => new BuildSubcontextsTask(api, args),
    private readonly _buildBaseContextsTaskFactory = (
      api: InternalApi,
      args: BuildBaseContextsArgs,
    ) => new BuildBaseContexts(api, args),
    private readonly _preBuildNestedCallDataTaskFactory = (
      args: ParseNestedTransactionTaskArgs,
    ) => new ParseNestedTransactionTask(args),
  ) {}

  async run(): Promise<BuildFullContextsTaskResult> {
    // get the base contexts
    const { clearSignContexts, clearSigningType, clearSignContextsOptional } =
      await this._buildBaseContextsTaskFactory(this._api, this._args).run();

    // for each context, build the subcontexts
    const contextsWithSubContexts: ContextWithSubContexts[] =
      clearSignContexts.map((context: ClearSignContextSuccess) => {
        const { subcontextCallbacks } = this._buildSubcontextsTaskFactory(
          this._api,
          {
            context,
            contextOptional: clearSignContextsOptional,
            contextModule: this._args.contextModule,
            subset: this._args.subset,
            transactionParser: this._args.parser,
            deviceModelId: this._args.deviceModelId,
          },
        ).run();

        return {
          context,
          subcontextCallbacks,
        };
      });

    // recursively build the nested contexts
    let contextWithNestedContexts: ContextWithSubContexts[] = [];
    for (const context of contextsWithSubContexts) {
      if (
        context.context.type ===
          ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION &&
        context.context.reference?.type ===
          ClearSignContextReferenceType.CALLDATA
      ) {
        const { subsets } = this._preBuildNestedCallDataTaskFactory({
          parser: this._args.parser,
          subset: this._args.subset,
          context: context.context,
        }).run();

        for (const subset of subsets) {
          const { clearSignContexts: nestedContexts } =
            await new BuildFullContextsTask(
              this._api,
              {
                ...this._args,
                subset,
              },
              // inject the factories for testing
              this._buildSubcontextsTaskFactory,
              this._buildBaseContextsTaskFactory,
              this._preBuildNestedCallDataTaskFactory,
            ).run();

          // TODO: this order will change with app optimizations
          // currently the order is:
          // previous contexts, nested transaction info and nested fields, calldata field from the parent,
          // futurre order:
          // previous contexts, nested transaction info, calldata field from the parent, then nested fields
          contextWithNestedContexts = [
            ...contextWithNestedContexts, // previous contexts
            ...nestedContexts, // nested transaction info and nested fields
            context, // calldatafield from the parent,
          ];
        }
      } else {
        contextWithNestedContexts.push(context);
      }
    }

    return {
      clearSignContexts: contextWithNestedContexts,
      clearSigningType,
    };
  }
}
