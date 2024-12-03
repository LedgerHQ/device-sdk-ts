import {
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { PublicKey } from "@near-js/crypto";
import { type Action, createTransaction } from "@near-js/transactions";

import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";
import { SignUtils } from "@internal/shared/utils/SignUtils";

const PATH_SIZE = 4;

export type SignTransactionTaskArgs = {
  derivationPath: string;
  nonce: bigint;
  signerId: string;
  receiverId: string;
  actions: Action[];
  blockHash: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private _api: InternalApi,
    private _args: SignTransactionTaskArgs,
  ) {}

  async run(pubKey: string): Promise<CommandResult<Uint8Array>> {
    const { derivationPath, signerId, actions, nonce, receiverId, blockHash } =
      this._args;
    const paths = DerivationPathUtils.splitPath(derivationPath);
    const publicKey = PublicKey.fromString(pubKey);
    const transaction = createTransaction(
      signerId,
      publicKey,
      receiverId,
      nonce,
      actions,
      blockHash,
    ).encode();

    const builder = new ByteArrayBuilder(
      transaction.length + 1 + paths.length * PATH_SIZE,
    );
    // add every derivation path
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });
    // add the transaction
    builder.addBufferToData(transaction);

    const buffer = builder.build();

    const utils = new SignUtils(this._api);
    const result = await utils.signInChunks(SignTransactionCommand, buffer);

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
