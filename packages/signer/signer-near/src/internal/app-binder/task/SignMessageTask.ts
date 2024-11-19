import {
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { BorshSchema, borshSerialize } from "borsher";

import { SignMessageCommand } from "@internal/app-binder/command/SignMessageCommand";
import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";
import { SignUtils } from "@internal/shared/utils/SignUtils";

const PATH_SIZE = 4;
const BORSH_PREFIX_SIZE = 4;

export type SignMessageTaskArgs = {
  derivationPath: string;
  message: string;
  recipient: string;
  nonce: Uint8Array;
  callbackUrl?: string;
};

export class SignMessageTask {
  constructor(
    private _api: InternalApi,
    private _args: SignMessageTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Uint8Array>> {
    const { derivationPath, message, nonce, recipient, callbackUrl } =
      this._args;
    const paths = DerivationPathUtils.splitPath(derivationPath);
    const pathSize = paths.length * PATH_SIZE;
    const messageSize = message.length + BORSH_PREFIX_SIZE;
    const nonceSize = nonce.length;
    const recipientSize = recipient.length + BORSH_PREFIX_SIZE;
    const callbackUrlSize = callbackUrl
      ? callbackUrl.length + BORSH_PREFIX_SIZE + 1
      : 1;

    const builder = new ByteArrayBuilder(
      pathSize + messageSize + nonceSize + recipientSize + callbackUrlSize,
    );
    // add every derivation path
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });
    builder.addBufferToData(borshSerialize(BorshSchema.String, message));
    builder.addBufferToData(nonce);
    builder.addBufferToData(borshSerialize(BorshSchema.String, recipient));
    if (callbackUrl) {
      builder.add8BitUIntToData(1);
      builder.addBufferToData(borshSerialize(BorshSchema.String, callbackUrl));
    } else {
      builder.add8BitUIntToData(0);
    }
    const buffer = builder.build();
    const utils = new SignUtils(this._api);
    const result = await utils.signInChunks(SignMessageCommand, buffer);

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
