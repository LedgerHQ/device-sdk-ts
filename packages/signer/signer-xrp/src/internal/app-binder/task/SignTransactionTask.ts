import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidResponseFormatError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type XrpErrorCodes } from "@internal/app-binder/command/utils/xrpApplicationErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, XrpErrorCodes>> {
    // TODO: chunk the payload (DSDK-1440). This sends the transaction as a
    // single first-and-last chunk, which only holds for payloads that fit in
    // one APDU, and it does not yet prepend the encoded derivation path.
    const result = await this.api.sendCommand(
      new SignTransactionCommand({
        chunkedData: this.args.transaction,
        isFirstChunk: true,
        isLastChunk: true,
      }),
    );

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    return result.data.caseOf({
      Just: (signature) => CommandResultFactory({ data: signature }),
      Nothing: () =>
        CommandResultFactory<Signature, XrpErrorCodes>({
          error: new InvalidResponseFormatError(
            "No signature returned for the final chunk",
          ),
        }),
    });
  }
}
