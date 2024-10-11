// https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/bitcoin.md#get_extended_pubkey
import {
  Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";

const STATUS_CODE_LENGTH = 2;

export type GetExtendedPublicKeyCommandArgs = {
  displayOnDevice: boolean;
  derivationPath: string;
};

export type GetExtendedPublicKeyCommandResponse = {
  extendedPublicKey: string;
};

export class GetExtendedPublicKeyCommand
  implements
    Command<
      GetExtendedPublicKeyCommandResponse,
      GetExtendedPublicKeyCommandArgs
    >
{
  constructor(private readonly args: GetExtendedPublicKeyCommandArgs) {}

  getApdu(): Apdu {
    const { displayOnDevice, derivationPath } = this.args;

    const getExtendedPublicKeyArgs: ApduBuilderArgs = {
      cla: 0xe1,
      ins: 0x00,
      p1: 0x00,
      p2: 0x00,
    };
    const builder = new ApduBuilder(getExtendedPublicKeyArgs).add8BitUIntToData(
      displayOnDevice ? 0x01 : 0x00,
    );

    const path = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetExtendedPublicKeyCommandResponse> {
    const parser = new ApduParser(response);

    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

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
  }
}
