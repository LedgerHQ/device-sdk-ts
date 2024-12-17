// https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/bitcoin.md#get_extended_pubkey
import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { type BitcoinAppErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { BtcCommand } from "@internal/app-binder/command/utils/BtcCommand";

const STATUS_CODE_LENGTH = 2;

export type GetExtendedPublicKeyCommandArgs = {
  checkOnDevice: boolean;
  derivationPath: string;
};

export type GetExtendedPublicKeyCommandResponse = {
  extendedPublicKey: string;
};

export class GetExtendedPublicKeyCommand extends BtcCommand<
  GetExtendedPublicKeyCommandResponse,
  GetExtendedPublicKeyCommandArgs
> {
  constructor(private readonly args: GetExtendedPublicKeyCommandArgs) {
    super();
  }

  override getApdu(): Apdu {
    const { checkOnDevice, derivationPath } = this.args;

    const getExtendedPublicKeyArgs: ApduBuilderArgs = {
      cla: 0xe1,
      ins: 0x00,
      p1: 0x00,
      p2: 0x00,
    };
    const builder = new ApduBuilder(getExtendedPublicKeyArgs).add8BitUIntToData(
      checkOnDevice ? 0x01 : 0x00,
    );

    const path = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  override parseResponse(
    response: ApduResponse,
  ): CommandResult<GetExtendedPublicKeyCommandResponse, BitcoinAppErrorCodes> {
    return this._getError(response).orDefaultLazy(() => {
      const parser = new ApduParser(response);
      const length = parser.getUnparsedRemainingLength() - STATUS_CODE_LENGTH;

      if (length <= 0) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Invalid response length"),
        });
      }

      const extendedPublicKey = parser.encodeToString(
        parser.extractFieldByLength(length),
      );

      return CommandResultFactory({
        data: {
          extendedPublicKey,
        },
      });
    });
  }
}
