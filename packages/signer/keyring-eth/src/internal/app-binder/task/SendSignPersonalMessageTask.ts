import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  CommandResult,
  CommandResultFactory,
  InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Nothing } from "purify-ts";

import { Signature } from "@api/model/Signature";
import {
  SignPersonalMessageCommand,
  SignPersonalMessageCommandResponse,
} from "@internal/app-binder/command/SignPersonalMessageCommand";
import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";

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
    builder.addAsciiStringToData(message);

    const buffer = builder.build();

    let result = CommandResultFactory<SignPersonalMessageCommandResponse, void>(
      { data: Nothing },
    );

    // Split the buffer into chunks
    for (let i = 0; i < buffer.length; i += APDU_MAX_PAYLOAD) {
      result = await this.api.sendCommand(
        new SignPersonalMessageCommand({
          data: buffer.slice(i, i + APDU_MAX_PAYLOAD),
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
