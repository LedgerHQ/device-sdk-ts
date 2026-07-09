import {
  ClearSignContextType,
  isSolanaContextSuccess,
  type SolanaContext,
} from "@ledgerhq/context-module";
import {
  type InternalApi,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import {
  DefaultSolanaMessageNormaliser,
  type SolanaMessageNormaliser,
} from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";

import { dispatchProvideContext } from "./context-providers/provideContextRegistry";
import { type ProvideContextDeps } from "./context-providers/provideContextTypes";
import { type BasicClearSignContext } from "./BuildBasicClearSignContextTask";

export type ProvideBasicClearSignContextTaskArgs = BasicClearSignContext & {
  readonly transactionBytes: Uint8Array;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
  readonly normaliser?: SolanaMessageNormaliser;
};

export class ProvideBasicClearSignContextTask {
  private readonly _logger: LoggerPublisherService;
  private readonly _deps: ProvideContextDeps;
  constructor(
    api: InternalApi,
    private readonly args: ProvideBasicClearSignContextTaskArgs,
  ) {
    this._logger = args.loggerFactory("ProvideBasicClearSignContextTask");
    this._deps = {
      api,
      logger: this._logger,
      normaliser: args.normaliser ?? new DefaultSolanaMessageNormaliser(),
      transactionBytes: args.transactionBytes,
    };
  }

  private static readonly PROVISION_ORDER = [
    ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME,
    ClearSignContextType.SOLANA_TOKEN,
    ClearSignContextType.SOLANA_LIFI,
    ClearSignContextType.SOLANA_TRANSACTION_CHECK,
  ] as const;

  async run(): Promise<void> {
    this._logger.debug("[run] Starting ProvideBasicClearSignContextTask");
    const { loadersResults } = this.args;

    const ordered = ProvideBasicClearSignContextTask.PROVISION_ORDER.map(
      (type) => loadersResults.find((c) => c.type === type),
    ).filter((c): c is SolanaContext => c !== undefined);

    this._logger.debug("[run] Providing Solana context from loaders", {
      data: { ordered },
    });

    for (const loaderResult of ordered) {
      if (!isSolanaContextSuccess(loaderResult)) continue;
      this._logger.debug(`[run] Providing ${loaderResult.type}`);
      await dispatchProvideContext(loaderResult, this._deps);
    }
  }
}
