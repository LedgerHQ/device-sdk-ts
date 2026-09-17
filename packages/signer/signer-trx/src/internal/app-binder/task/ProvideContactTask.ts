import {
  sendProvideContactPayload,
  type SendProvideContactPayloadArgs,
} from "@ledgerhq/device-contacts-kit";
import {
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type AppConfiguration } from "@api/model/AppConfiguration";
import { type TronAddressBook } from "@api/model/TronAddressBook";
import { buildExternalContactPayload } from "@internal/shared/utils/buildExternalContactPayload";
import { extractTransactionRecipient } from "@internal/shared/utils/extractTransactionRecipient";

type ProvideContactTaskArgs = {
  readonly addressBook: TronAddressBook;
  readonly transaction: Uint8Array;
  readonly appConfig: AppConfiguration | null;
};

export class ProvideContactTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideContactTaskArgs,
  ) {}

  async run(): Promise<void> {
    const recipient = extractTransactionRecipient(this.args.transaction);
    if (recipient === undefined || this.args.appConfig === null) return;

    const payload = buildExternalContactPayload({
      addressBook: this.args.addressBook,
      recipient,
      deviceState: this.api.getDeviceSessionState(),
      appConfig: this.args.appConfig,
    });
    if (payload === undefined) return;

    const logger = this.api.loggerFactory?.("ProvideContactTask");
    const result = await sendProvideContactPayload(this.api, {
      payload,
      logger,
    } satisfies SendProvideContactPayloadArgs);
    if (!isSuccessCommandResult(result)) {
      logger?.warn("[run] Contact rejected, signing without it", {
        data: { error: result.error },
      });
    }
  }
}
