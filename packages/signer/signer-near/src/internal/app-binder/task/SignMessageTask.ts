import {
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { BorshSchema, borshSerialize } from "borsher";

import { type NearAppErrorCodes } from "@internal/app-binder/command/NearAppCommand";
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
  private readonly _utils: SignUtils;
  constructor(
    private readonly _api: InternalApi,
    private readonly _args: SignMessageTaskArgs,
  ) {
    this._utils = new SignUtils(this._api);
  }

  async run(): Promise<CommandResult<Uint8Array, NearAppErrorCodes>> {
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
    // add borsh message
    builder.addBufferToData(borshSerialize(BorshSchema.String, message));
    // add nonce
    builder.addBufferToData(nonce);
    // add borsh recipient id
    builder.addBufferToData(borshSerialize(BorshSchema.String, recipient));

    if (callbackUrl) {
      // add 1 + borsh callback url
      builder.add8BitUIntToData(1);
      builder.addBufferToData(borshSerialize(BorshSchema.String, callbackUrl));
    } else {
      // add 0
      builder.add8BitUIntToData(0);
    }
    const buffer = builder.build();
    const result = await this._utils.signInChunks(SignMessageCommand, buffer);

    if (!isSuccessCommandResult(result)) {
      return result;
    } else if (result.data.isJust()) {
      return CommandResultFactory({
        data: result.data.extract(),
      });
    }
    return CommandResultFactory({
      error: new InvalidStatusWordError("no signature returned"),
    });
  }
}
