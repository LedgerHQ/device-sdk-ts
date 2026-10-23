import {
  type CommandErrorResult,
  type DmkResult,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { sha256 } from "@noble/hashes/sha256";
import bs58 from "bs58";

import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import { LegacyGetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import {
  compressPublicKey,
  hashPublicKey,
} from "@internal/app-binder/task/utils/legacyTransactionUtils";

const EXTENDED_KEY_LENGTH = 78;

export type GetExtendedPublicKeyTaskArgs<ErrorCodes extends string> = {
  readonly derivationPath: string;
  readonly profile: LegacyCoinProfile<ErrorCodes>;
};

export type GetExtendedPublicKeyTaskData = {
  readonly extendedPublicKey: string;
};

export type GetExtendedPublicKeyTaskResult<ErrorCodes extends string> =
  DmkResult<
    GetExtendedPublicKeyTaskData,
    CommandErrorResult<ErrorCodes>["error"]
  >;

// The fingerprint comes from the parent key, so the path needs a parent. The
// app binder checks it before opening the app too.
export const validateExtendedPublicKeyPath = (
  derivationPath: string,
): InvalidStatusWordError | undefined => {
  let path: number[];
  try {
    path = DerivationPathUtils.splitPath(derivationPath);
  } catch {
    return new InvalidStatusWordError("Invalid derivation path");
  }

  return path.length < 2
    ? new InvalidStatusWordError(
        "The derivation path needs at least two levels",
      )
    : undefined;
};

/**
 * The legacy protocol has no xpub command: the BIP32 extended key is built on
 * the host from two get address calls, the parent's key for the fingerprint
 * and the account's key and chain code, as hw-app-btc's `BtcOld` does.
 */
export class GetExtendedPublicKeyTask<ErrorCodes extends string> {
  constructor(
    private readonly api: InternalApi,
    private readonly args: GetExtendedPublicKeyTaskArgs<ErrorCodes>,
  ) {}

  async run(): Promise<GetExtendedPublicKeyTaskResult<ErrorCodes>> {
    const { derivationPath, profile } = this.args;
    const pathError = validateExtendedPublicKeyPath(derivationPath);
    if (pathError !== undefined) {
      return DmkResultFactory({ error: pathError });
    }
    const path = DerivationPathUtils.splitPath(derivationPath);

    const parent = await this.api.sendCommand(
      new LegacyGetAddressCommand(
        {
          derivationPath: derivationPath.slice(
            0,
            derivationPath.lastIndexOf("/"),
          ),
        },
        profile.errors,
      ),
    );
    if (!isSuccessCommandResult(parent)) {
      return DmkResultFactory({ error: parent.error });
    }

    const account = await this.api.sendCommand(
      new LegacyGetAddressCommand({ derivationPath }, profile.errors),
    );
    if (!isSuccessCommandResult(account)) {
      return DmkResultFactory({ error: account.error });
    }

    const extendedKey = new Uint8Array(EXTENDED_KEY_LENGTH);
    const view = new DataView(extendedKey.buffer);
    view.setUint32(0, profile.xpubVersion);
    view.setUint8(4, path.length);
    extendedKey.set(
      hashPublicKey(compressPublicKey(parent.data.publicKey)).subarray(0, 4),
      5,
    );
    view.setUint32(9, path[path.length - 1]!);
    extendedKey.set(account.data.chainCode, 13);
    extendedKey.set(compressPublicKey(account.data.publicKey), 45);

    const checksum = sha256(sha256(extendedKey)).subarray(0, 4);
    const payload = new Uint8Array(EXTENDED_KEY_LENGTH + 4);
    payload.set(extendedKey);
    payload.set(checksum, EXTENDED_KEY_LENGTH);

    return DmkResultFactory({
      data: { extendedPublicKey: bs58.encode(payload) },
    });
  }
}
