import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type SuiSignature } from "@api/model/SuiSignature";
import { type SuiAppErrorCodes } from "@internal/app-binder/command/utils/SuiAppErrors";
import { BlockProtocolTask } from "@internal/app-binder/task/BlockProtocolTask";
import { encodeSuiDerivationPath } from "@internal/app-binder/task/SuiDerivationPathUtils";

const ED25519_SIGNATURE_LENGTH = 64;

export type SignPersonalMessageTaskArgs = {
  derivationPath: string;
  message: Uint8Array;
};

/**
 * Signs a personal message using the Sui Ledger app (INS 0x03).
 *
 * The message bytes should already be intent-wrapped by the caller
 * (e.g. messageWithIntent('PersonalMessage', bcs.byteVector().serialize(bytes))).
 *
 * Params sent via block protocol:
 *   1. [msg_size (u32 LE)] [msg_bytes]  (same format as transaction)
 *   2. BIP32 path
 *
 * Response: 64-byte Ed25519 signature.
 */
export class SignPersonalMessageTask {
  constructor(
    private api: InternalApi,
    private args: SignPersonalMessageTaskArgs,
  ) {}

  async run(): Promise<CommandResult<SuiSignature, SuiAppErrorCodes>> {
    const params: Uint8Array[] = [];

    // Param 1: message size (u32 LE) + message bytes
    const msgPayload = new Uint8Array(4 + this.args.message.length);
    new DataView(msgPayload.buffer).setUint32(
      0,
      this.args.message.length,
      true,
    );
    msgPayload.set(this.args.message, 4);
    params.push(msgPayload);

    // Param 2: BIP32 path
    params.push(encodeSuiDerivationPath(this.args.derivationPath));

    const result = await new BlockProtocolTask(this.api, {
      cla: 0x00,
      ins: 0x03,
      p1: 0x00,
      p2: 0x00,
      params,
    }).run();

    if ("error" in result) {
      return result;
    }

    if (result.data.length < ED25519_SIGNATURE_LENGTH) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          `Expected ${ED25519_SIGNATURE_LENGTH}-byte signature, got ${result.data.length} bytes`,
        ),
      });
    }

    return CommandResultFactory({
      data: result.data.slice(0, ED25519_SIGNATURE_LENGTH),
    });
  }
}
