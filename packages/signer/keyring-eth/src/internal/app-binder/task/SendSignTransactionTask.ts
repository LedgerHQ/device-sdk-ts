import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  CommandResult,
  CommandResultFactory,
  InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-sdk-core";
import { Nothing } from "purify-ts";

import { Signature } from "@api/index";
import {
  SignTransactionCommand,
  SignTransactionCommandResponse,
} from "@internal/app-binder/command/SignTransactionCommand";
import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";

const PATH_SIZE = 4;

type SendSignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SendSignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SendSignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, void>> {
    const { derivationPath, transaction } = this.args;
    const paths = DerivationPathUtils.splitPath(derivationPath);

    const builder = new ByteArrayBuilder(
      transaction.length + 1 + paths.length * PATH_SIZE,
    );
    // add the derivation paths length
    builder.add8BitUIntToData(paths.length);
    // add every derivation path
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });
    // add the transaction
    builder.addBufferToData(transaction);

    const buffer = builder.build();

    let result = CommandResultFactory<SignTransactionCommandResponse, void>({
      data: Nothing,
    });

    // Split the buffer into chunks
    for (let i = 0; i < buffer.length; i += APDU_MAX_PAYLOAD) {
      result = await this.api.sendCommand(
        new SignTransactionCommand({
          transaction: buffer.slice(i, i + APDU_MAX_PAYLOAD),
          isFirstChunk: i === 0,
        }),
      );

      if (!isSuccessCommandResult(result)) {
        return result;
      }
    }

    if (isSuccessCommandResult(result) && result.data.isJust()) {
      return CommandResultFactory({
        data: result.data.extract(),
      });
    }

    return CommandResultFactory({
      error: new InvalidStatusWordError("no signature returned"),
    });
  }
}
