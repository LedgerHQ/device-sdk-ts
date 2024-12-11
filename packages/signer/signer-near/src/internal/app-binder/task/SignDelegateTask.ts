import {
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { PublicKey } from "@near-js/crypto";
import { type Action, SCHEMA } from "@near-js/transactions";
import { BorshSchema, borshSerialize } from "borsher";

import { type NearAppErrorCodes } from "@internal/app-binder/command/NearAppCommand";
import { SignDelegateCommand } from "@internal/app-binder/command/SignDelegateCommand";
import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";
import { SignUtils } from "@internal/shared/utils/SignUtils";

export type SignDelegateTaskArgs = {
  derivationPath: string;
  maxBlockHeight: bigint;
  nonce: bigint;
  actions: Action[];
  senderId: string;
  receiverId: string;
};

const PATH_SIZE = 4;

/**
 * SignDelegateTask class is responsible for handling delegated signing operations.
 * It constructs a transaction utilizing the provided arguments and performs signing
 * using the user's private keys. This class interacts with an internal API and leverages
 * SignUtils for chunked signing operations.
 */
export class SignDelegateTask {
  private _utils: SignUtils;

  constructor(
    private readonly _api: InternalApi,
    private readonly _args: SignDelegateTaskArgs,
  ) {
    this._utils = new SignUtils(this._api);
  }

  /**
   * Executes the signing process for a NEP366 Delegate Action based on the provided public key.
   *
   * @param {string} pubKey The public key used to create or authenticate the transaction. Must be a valid string representation of a public key.
   * @return {Promise<CommandResult<Uint8Array>>} A Promise that resolves to a CommandResult containing the signed transaction data (as a Uint8Array)
   *                                             or an error if the signing process fails.
   */
  async run(
    pubKey: string,
  ): Promise<CommandResult<Uint8Array, NearAppErrorCodes>> {
    const {
      derivationPath,
      nonce,
      receiverId,
      actions,
      senderId,
      maxBlockHeight,
    } = this._args;
    const paths = DerivationPathUtils.splitPath(derivationPath);
    let publicKey;
    try {
      publicKey = PublicKey.fromString(pubKey);
    } catch {
      return Promise.resolve(
        CommandResultFactory({
          error: new InvalidStatusWordError("Invalid public key"),
        }),
      );
    }
    // get borsh delegate action
    let tx: Uint8Array;
    try {
      tx = borshSerialize(BorshSchema.fromSchema(SCHEMA.DelegateAction), {
        senderId,
        publicKey,
        nonce,
        receiverId,
        maxBlockHeight,
        actions,
      });
    } catch {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Invalid schema"),
      });
    }
    const builder = new ByteArrayBuilder(tx.length + paths.length * PATH_SIZE);
    // add every derivation path
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });
    // add the transaction
    builder.addBufferToData(tx);
    const buffer = builder.build();
    const result = await this._utils.signInChunks(SignDelegateCommand, buffer);

    if (!isSuccessCommandResult(result)) {
      return result;
    } else if (result.data.isJust()) {
      return CommandResultFactory({
        data: result.data.extract(),
      });
    }

    return CommandResultFactory({
      error: new InvalidStatusWordError("No signature returned"),
    });
  }
}
