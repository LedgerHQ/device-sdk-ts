import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
} from "@ledgerhq/device-management-kit";

import {
  type GetWalletIdCommandArgs,
  type GetWalletIdCommandResponse,
} from "@api/app-binder/GetWalletIdCommandTypes";
import {
  NearAppCommand,
  type NearAppErrorCodes,
} from "@internal/app-binder/command/NearAppCommand";
import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";

const WALLET_ID_LENGTH = 32;

export class GetWalletIdCommand extends NearAppCommand<
  GetWalletIdCommandResponse,
  GetWalletIdCommandArgs
> {
  args: GetWalletIdCommandArgs;

  constructor(args: GetWalletIdCommandArgs) {
    super();
    this.args = args;
  }

  override getApdu(): Apdu {
    const getNearWalletIdArgs: ApduBuilderArgs = {
      cla: 0x80,
      ins: 0x05,
      p1: 0x00,
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

  override parseResponse(
    response: ApduResponse,
  ): CommandResult<GetWalletIdCommandResponse, NearAppErrorCodes> {
    const parser = new ApduParser(response);

    if (!CommandUtils.isSuccessResponse(response)) {
      return this._getError(response, parser);
    }
    const walletId = parser.encodeToHexaString(
      parser.extractFieldByLength(WALLET_ID_LENGTH),
    );

    return CommandResultFactory({
      data: walletId,
    });
  }
}
