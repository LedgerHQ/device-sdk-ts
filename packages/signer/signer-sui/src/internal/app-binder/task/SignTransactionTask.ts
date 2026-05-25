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

export type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
  objectData?: Uint8Array[];
};

/**
 * Signs a transaction using the Sui Ledger app (INS 0x03).
 *
 * Params sent via block protocol:
 *   1. [tx_size (u32 LE)] [tx_bytes]
 *   2. BIP32 path
 *   3. (optional) object data for clear signing: [num_objects (u32 LE)] [obj_len (u32 LE) obj_data] ...
 *
 * Response: 64-byte Ed25519 signature.
 */
export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<SuiSignature, SuiAppErrorCodes>> {
    const params: Uint8Array[] = [];

    // Param 1: transaction size (u32 LE) + transaction bytes
    const txPayload = new Uint8Array(4 + this.args.transaction.length);
    new DataView(txPayload.buffer).setUint32(
      0,
      this.args.transaction.length,
      true,
    );
    txPayload.set(this.args.transaction, 4);
    params.push(txPayload);

    // Param 2: BIP32 path
    params.push(encodeSuiDerivationPath(this.args.derivationPath));

    // Param 3 (optional): object data for clear signing
    const objects = this.args.objectData ?? [];
    if (objects.length > 0) {
      const parts: Uint8Array[] = [];

      // Number of objects (u32 LE)
      const numItems = new Uint8Array(4);
      new DataView(numItems.buffer).setUint32(0, objects.length, true);
      parts.push(numItems);

      // Each object: [length (u32 LE)] [data]
      for (const item of objects) {
        const itemLen = new Uint8Array(4);
        new DataView(itemLen.buffer).setUint32(0, item.length, true);
        parts.push(itemLen);
        parts.push(item);
      }

      const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
      const objectPayload = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) {
        objectPayload.set(part, offset);
        offset += part.length;
      }
      params.push(objectPayload);
    }

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
