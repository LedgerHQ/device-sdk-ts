import {
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { type Signature } from "@api/model/Signature";
import {
  SignPersonalMessageCommand,
  type SignPersonalMessageCommandResponse,
} from "@internal/app-binder/command/SignPersonalMessageCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

import { SendCommandInChunksTask } from "./SendCommandInChunksTask";

const PATH_SIZE = 4;

type SendSignPersonalMessageTaskArgs = {
  derivationPath: string;
  message: string | Uint8Array;
};

export class SendSignPersonalMessageTask {
  constructor(
    private api: InternalApi,
    private args: SendSignPersonalMessageTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, EthErrorCodes>> {
    const { derivationPath, message } = this.args;
    const paths = DerivationPathUtils.splitPath(derivationPath);

    const builder = new ByteArrayBuilder(
      message.length + 1 + (paths.length + 1) * PATH_SIZE,
    );
    // add the derivation paths length
    builder.add8BitUIntToData(paths.length);
    // add every derivation path
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });
    // add message length
    builder.add32BitUIntToData(message.length);
    // add the message
    if (typeof message === "string") {
      builder.addAsciiStringToData(message);
    } else {
      builder.addBufferToData(message);
    }

    const buffer = builder.build();

    const result =
      await new SendCommandInChunksTask<SignPersonalMessageCommandResponse>(
        this.api,
        {
          data: buffer,
          commandFactory: (args) => new SignPersonalMessageCommand(args),
        },
      ).run();

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    return result.data.mapOrDefault(
      (data) => CommandResultFactory({ data }),
      CommandResultFactory({
        error: new InvalidStatusWordError("no signature returned"),
      }),
    );
  }
}
