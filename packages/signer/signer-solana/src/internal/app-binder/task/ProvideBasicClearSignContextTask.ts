import { isSolanaContextSuccess } from "@ledgerhq/context-module";
import {
  type InternalApi,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";
import {
  DefaultSolanaMessageNormaliser,
  type SolanaMessageNormaliser,
} from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";

import { loadCertificate } from "./context-providers/loadCertificate";
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
    private readonly api: InternalApi,
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

  async run(): Promise<void> {
    this._logger.debug("[run] Starting ProvideBasicClearSignContextTask");
    const { tlvDescriptor, trustedNamePKICertificate, loadersResults } =
      this.args;

    // --------------------------------------------------------------------
    // providing default solana context (trusted name cert + TLV descriptor)
    // only needed when owner info was resolved (SPL token flows)
    if (trustedNamePKICertificate && tlvDescriptor) {
      await loadCertificate(
        this.api,
        trustedNamePKICertificate,
        "[SignerSolana] ProvideBasicClearSignContextTask: failed to load trusted-name certificate",
      );
      await this.api.sendCommand(
        new ProvideTLVDescriptorCommand({ payload: tlvDescriptor }),
      );
    }

    // --------------------------------------------------------------------
    // providing optional solana context via context module loaders results
    this._logger.debug("[run] Providing optional Solana context from loaders", {
      data: { loadersResults },
    });

    for (const loaderResult of loadersResults) {
      // Skip non-success (ERROR) loader results; same guard the generic
      // provide task uses for its pool descriptors.
      if (!isSolanaContextSuccess(loaderResult)) {
        this._logger.debug("[run] Non-success loader result, skipping", {
          data: { type: loaderResult.type },
        });
        continue;
      }
      this._logger.debug(`[run] Providing ${loaderResult.type}`);
      await dispatchProvideContext(loaderResult, this._deps);
    }
  }
}
