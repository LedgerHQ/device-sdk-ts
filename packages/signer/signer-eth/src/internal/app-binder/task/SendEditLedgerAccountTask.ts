// Editing a Ledger account is a single APDU (P1=0x12): the device verifies the
// seed-bound HMAC proof, shows the rename review, and returns a freshly rotated
// proof. Unlike RegisterLedgerAccount there is no follow-up GetAddress — the
// address is unchanged by a rename. Wrapped by CallTaskInAppDeviceAction in
// EthAppBinder to match every other action in the package.
import {
  type CommandResult,
  type ContactsErrorCodes,
  type InternalApi,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import {
  type EditLedgerAccountArgs,
  type EditLedgerAccountResult,
} from "@api/model/EditLedgerAccountArgs";
import { EditLedgerAccountCommand } from "@internal/app-binder/command/EditLedgerAccountCommand";

type SendEditLedgerAccountTaskArgs = EditLedgerAccountArgs & {
  readonly logger: LoggerPublisherService;
};

export class SendEditLedgerAccountTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private readonly _api: InternalApi,
    private readonly _args: SendEditLedgerAccountTaskArgs,
  ) {
    this._logger = _args.logger;
  }

  async run(): Promise<
    CommandResult<EditLedgerAccountResult, ContactsErrorCodes>
  > {
    this._logger.info("[run] starting EditLedgerAccount", {
      tag: "SendEditLedgerAccountTask",
      data: {
        oldName: this._args.oldName,
        name: this._args.name,
        chainId: this._args.chainId,
        derivationPath: this._args.derivationPath,
      },
    });

    return this._api.sendCommand(
      new EditLedgerAccountCommand({
        name: this._args.name,
        oldName: this._args.oldName,
        derivationPath: this._args.derivationPath,
        chainId: this._args.chainId,
        hmacProofHex: this._args.hmacProofHex,
      }),
    );
  }
}
