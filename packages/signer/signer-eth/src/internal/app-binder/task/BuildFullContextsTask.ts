import {
  type ClearSignContext,
  ClearSignContextReferenceType,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  type EthereumClearSignContextSuccess,
  type TransactionSubset,
} from "@ledgerhq/context-module";
import {
  type DeviceModelId,
  type InternalApi,
  type LoggerPublisherService,
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
  readonly contextErrorCount: number;
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
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
};

export type ContextWithSubContexts = {
  context: EthereumClearSignContextSuccess;
  subcontextCallbacks: (() => Promise<ClearSignContext>)[];
};

export class BuildFullContextsTask {
  private readonly _logger: LoggerPublisherService;

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
  ) {
    this._logger = _args.loggerFactory("BuildFullContextsTask");
  }

  async run(): Promise<BuildFullContextsTaskResult> {
    this._logger.debug("[run] Starting BuildFullContextsTask");

    // get the base contexts
    const {
      clearSignContexts: rawClearSignContexts,
      clearSigningType,
      clearSignContextsOptional,
      contextErrorCount,
    } = await this._buildBaseContextsTaskFactory(this._api, this._args).run();

    // Contacts wins on collision: drop TRUSTED_NAME (ENS, etc.)
    // entries whose target address is also covered by a CONTACT_*
    // entry, so the device renders the user-chosen friendly name
    // rather than the trusted-name source. TrustedName loaders only
    // resolve `subset.to`, so the check reduces to "is `subset.to`
    // covered by a CONTACT_*?".
    const clearSignContexts =
      this._dropTrustedNameSupersededByContact(rawClearSignContexts);

    this._logger.debug("[run] Base contexts built", {
      data: {
        clearSigningType,
        contextTypes: clearSignContexts.map((c) => c.type),
      },
    });

    // for each context, build the subcontexts
    const contextsWithSubContexts: ContextWithSubContexts[] =
      clearSignContexts.map((context: EthereumClearSignContextSuccess) => {
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
    const contextWithNestedContexts: ContextWithSubContexts[] = [];
    for (const context of contextsWithSubContexts) {
      contextWithNestedContexts.push(context);

      if (
        context.context.type ===
          ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION &&
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
                transaction: undefined, // don't pass the transaction to the nested context builder
                subset,
              },
              // inject the factories for testing
              this._buildSubcontextsTaskFactory,
              this._buildBaseContextsTaskFactory,
              this._preBuildNestedCallDataTaskFactory,
            ).run();

          // Contexts order as expected by the Ethereum application:
          // * previous contexts
          // * calldata field from the parent
          // * list of nested transactions infos and nested fields
          contextWithNestedContexts.push(...nestedContexts);
        }
      }
    }

    this._logger.debug("[run] BuildFullContextsTask completed", {
      data: {
        clearSigningType,
        contextTypes: contextWithNestedContexts.map((c) => c.context.type),
        hasNestedContexts:
          contextWithNestedContexts.length > clearSignContexts.length,
      },
    });

    return {
      clearSignContexts: contextWithNestedContexts,
      clearSigningType,
      contextErrorCount,
    };
  }

  private _dropTrustedNameSupersededByContact(
    contexts: EthereumClearSignContextSuccess[],
  ): EthereumClearSignContextSuccess[] {
    const addressesCoveredByContacts = new Set(
      contexts
        .filter(
          (c) =>
            c.type === ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL ||
            c.type === ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT,
        )
        .map((c) =>
          (
            c as ClearSignContextSuccess<
              | ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL
              | ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT
            >
          ).address.toLowerCase(),
        ),
    );
    const toAddress = this._args.subset.to?.toLowerCase();
    if (!toAddress || !addressesCoveredByContacts.has(toAddress)) {
      return contexts;
    }
    return contexts.filter(
      (c) => c.type !== ClearSignContextType.ETHEREUM_TRUSTED_NAME,
    );
  }
}
