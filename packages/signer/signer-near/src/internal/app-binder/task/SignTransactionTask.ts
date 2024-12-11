import {
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { PublicKey } from "@near-js/crypto";
import { type Action, SCHEMA } from "@near-js/transactions";
import { BorshSchema, borshSerialize } from "borsher";

import { type NearAppErrorCodes } from "@internal/app-binder/command/NearAppCommand";
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
  private _utils: SignUtils;
  constructor(
    private _api: InternalApi,
    private _args: SignTransactionTaskArgs,
  ) {
    this._utils = new SignUtils(this._api);
  }

  async run(
    pubKey: string,
  ): Promise<CommandResult<Uint8Array, NearAppErrorCodes>> {
    const { derivationPath, signerId, actions, nonce, receiverId, blockHash } =
      this._args;
    const paths = DerivationPathUtils.splitPath(derivationPath);
    let publicKey;

    try {
      publicKey = PublicKey.fromString(pubKey);
    } catch {
      return Promise.resolve(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Invalid public key"),
        }),
      );
    }
    const tx = borshSerialize(BorshSchema.fromSchema(SCHEMA.Transaction), {
      signerId,
      publicKey,
      nonce,
      receiverId,
      blockHash,
      actions,
    });

    const builder = new ByteArrayBuilder(tx.length + paths.length * PATH_SIZE);
    // add every derivation path
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });
    // add the transaction
    builder.addBufferToData(tx);

    const buffer = builder.build();

    const result = await this._utils.signInChunks(
      SignTransactionCommand,
      buffer,
    );

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
