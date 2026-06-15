import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type InternalApi,
  LoadCertificateCommand,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { type Maybe, Nothing } from "purify-ts";

import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import {
  DefaultSolanaMessageNormaliser,
  type SolanaMessageNormaliser,
} from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";

import { dispatchProvideContext } from "./context-providers/provideContextRegistry";
import { type ShallowClearSignContext } from "./BuildShallowClearSignContextTask";

export type ProvideShallowClearSignContextTaskArgs = ShallowClearSignContext & {
  readonly transactionBytes: Uint8Array;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
  readonly normaliser?: SolanaMessageNormaliser;
};

export class ProvideShallowClearSignContextTask {
  private readonly _logger: LoggerPublisherService;
  private readonly _normaliser: SolanaMessageNormaliser;
  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideShallowClearSignContextTaskArgs,
  ) {
    this._logger = args.loggerFactory("ProvideShallowClearSignContextTask");
    this._normaliser = args.normaliser ?? new DefaultSolanaMessageNormaliser();
  }

  async run(): Promise<Maybe<CommandErrorResult<SolanaAppErrorCodes>>> {
    this._logger.debug("[run] Starting ProvideShallowClearSignContextTask");
    const {
      tlvDescriptor,
      trustedNamePKICertificate,
      loadersResults,
      transactionBytes,
    } = this.args;

    // --------------------------------------------------------------------
    // providing default solana context (trusted name cert + TLV descriptor)
    // only needed when owner info was resolved (SPL token flows)

    if (trustedNamePKICertificate && tlvDescriptor) {
      await this.api.sendCommand(
        new LoadCertificateCommand({
          certificate: trustedNamePKICertificate.payload,
          keyUsage: trustedNamePKICertificate.keyUsageNumber,
        }),
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

    const deps = {
      api: this.api,
      logger: this._logger,
      normaliser: this._normaliser,
      transactionBytes,
    };

    for (const loaderResult of loadersResults) {
      if (loaderResult.type === ClearSignContextType.ERROR) {
        this._logger.debug("[run] Loader result of type ERROR, skipping");
        continue;
      }

      this._logger.debug(`[run] Providing ${loaderResult.type}`);
      await dispatchProvideContext(loaderResult, deps);
    }

    return Nothing;
  }
}
