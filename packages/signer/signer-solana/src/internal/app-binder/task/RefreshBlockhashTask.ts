import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";

import { BlockhashService } from "@internal/app-binder/services/BlockhashService";

export type RefreshBlockhashTaskArgs = {
  readonly transaction: Uint8Array;
  readonly rpcUrl?: string;
  readonly fetchBlockhash?: () => Promise<Uint8Array>;
  readonly blockhashService?: BlockhashService;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
};

/**
 * Best-effort blockhash refresh shared by the terminal signing machines: fetch
 * the latest blockhash and patch it into the transaction. Pure host-side (no
 * device interaction). A missing source, a fetch failure, or a patch failure
 * all degrade to the original transaction rather than throwing, so `run` always
 * resolves to the bytes to sign (patched on success, original otherwise).
 */
export class RefreshBlockhashTask {
  private readonly logger: LoggerPublisherService;
  private readonly blockhashService: BlockhashService;

  constructor(private readonly args: RefreshBlockhashTaskArgs) {
    this.logger = args.loggerFactory("RefreshBlockhashTask");
    this.blockhashService = args.blockhashService ?? new BlockhashService();
  }

  async run(): Promise<Uint8Array> {
    const { transaction, rpcUrl, fetchBlockhash } = this.args;

    // No source: nothing to refresh, sign the original transaction.
    if (!rpcUrl && !fetchBlockhash) {
      return transaction;
    }

    let freshBlockhash: Uint8Array;
    try {
      freshBlockhash = fetchBlockhash
        ? await fetchBlockhash()
        : await this.blockhashService.fetchLatestBlockhash(rpcUrl!);
    } catch (error) {
      this.logger.info(
        "[RefreshBlockhash] fetch failed, signing original blockhash",
        { data: { error } },
      );
      return transaction;
    }

    try {
      return this.blockhashService.patchBlockhash(transaction, freshBlockhash);
    } catch (error) {
      this.logger.info(
        "[RefreshBlockhash] patch failed, signing original blockhash",
        { data: { error } },
      );
      return transaction;
    }
  }
}
