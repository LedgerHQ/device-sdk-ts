import {
  ByteArrayBuilder,
  CommandResult,
  CommandResultFactory,
  InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { Signature } from "@api/index";
import {
  SignTransactionCommand,
  SignTransactionCommandResponse,
} from "@internal/app-binder/command/SignTransactionCommand";
import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";

import { SendCommandInChunksTask } from "./SendCommandInChunksTask";

const PATH_SIZE = 4;

type SendSignTransactionTaskArgs = {
  derivationPath: string;
  serializedTransaction: Uint8Array;
  isLegacy: boolean;
};

export class SendSignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SendSignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, void>> {
    const { derivationPath, serializedTransaction } = this.args;
    const paths = DerivationPathUtils.splitPath(derivationPath);

    const builder = new ByteArrayBuilder(
      serializedTransaction.length + 1 + paths.length * PATH_SIZE,
    );
    // add the derivation paths length
    builder.add8BitUIntToData(paths.length);
    // add every derivation path
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });
    // add the transaction
    builder.addBufferToData(serializedTransaction);

    const buffer = builder.build();

    const result =
      await new SendCommandInChunksTask<SignTransactionCommandResponse>(
        this.api,
        {
          data: buffer,
          commandFactory: (args) =>
            new SignTransactionCommand({
              serializedTransaction: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
              isLegacy: this.args.isLegacy,
            }),
        },
      ).run();

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    if (result.data.isJust()) {
      return CommandResultFactory({
        data: result.data.extract(),
      });
    }

    return CommandResultFactory({
      error: new InvalidStatusWordError("no signature returned"),
    });
  }
}
