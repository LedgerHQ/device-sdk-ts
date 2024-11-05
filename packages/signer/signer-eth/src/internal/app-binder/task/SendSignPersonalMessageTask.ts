import {
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  hexaStringToBuffer,
  type InternalApi,
  InvalidStatusWordError,
  isHexaString,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { type Signature } from "@api/model/Signature";
import {
  SignPersonalMessageCommand,
  type SignPersonalMessageCommandResponse,
} from "@internal/app-binder/command/SignPersonalMessageCommand";

import { SendCommandInChunksTask } from "./SendCommandInChunksTask";

const PATH_SIZE = 4;

type SendSignPersonalMessageTaskArgs = {
  derivationPath: string;
  message: string;
};

export class SendSignPersonalMessageTask {
  constructor(
    private api: InternalApi,
    private args: SendSignPersonalMessageTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, void>> {
    const { derivationPath, message } = this.args;
    const paths = DerivationPathUtils.splitPath(derivationPath);

    const messageLength = isHexaString(message)
      ? hexaStringToBuffer(message)!.length
      : message.length;

    const builder = new ByteArrayBuilder(
      messageLength + (paths.length + 1) * PATH_SIZE,
    );
    // add the derivation paths length
    builder.add8BitUIntToData(paths.length);
    // add every derivation path
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });
    // add message length
    builder.add32BitUIntToData(messageLength);
    // add the message
    if (isHexaString(message)) {
      builder.addHexaStringToData(message);
    } else {
      builder.addAsciiStringToData(message);
    }

    const buffer = builder.build();

    const result =
      await new SendCommandInChunksTask<SignPersonalMessageCommandResponse>(
        this.api,
        {
          data: buffer,
          commandFactory: (args) =>
            new SignPersonalMessageCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
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
