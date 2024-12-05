import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import {
  type GetWalletIdCommandArgs,
  type GetWalletIdCommandResponse,
} from "@api/app-binder/GetWalletIdCommandTypes";
import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";

const WALLET_ID_LENGTH = 32;

export class GetWalletIdCommand
  implements Command<GetWalletIdCommandResponse, GetWalletIdCommandArgs>
{
  args: GetWalletIdCommandArgs;

  constructor(args: GetWalletIdCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const getNearWalletIdArgs: ApduBuilderArgs = {
      cla: 0x80,
      ins: 0x05,
      p1: this.args.checkOnDevice ? 0x00 : 0x01,
      p2: 0x00,
    };
    const builder = new ApduBuilder(getNearWalletIdArgs);
    const derivationPath = this.args.derivationPath;

    const path = DerivationPathUtils.splitPath(derivationPath);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetWalletIdCommandResponse> {
    const parser = new ApduParser(response);

    // TODO: handle the error correctly using a generic error handler
    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }
    const walletId = parser.extractFieldByLength(WALLET_ID_LENGTH);

    if (walletId === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Invalid wallet id"),
      });
    }

    return CommandResultFactory({
      data: {
        walletId,
      },
    });
  }
}
