import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";

import {
  HYPERLIQUID_ERRORS,
  HyperliquidCommandErrorFactory,
  type HyperliquidErrorCodes,
} from "./utils/hyperliquidApplicationErrors";

export type SignActionsCommandArgs = {
  derivationPath: string;
};

export type SignActionsCommandResponse = {
  signature: {
    r: string;
    s: string;
    v: number;
  };
};

export class SignActionsCommand
  implements
    Command<
      SignActionsCommandResponse,
      SignActionsCommandArgs,
      HyperliquidErrorCodes
    >
{
  readonly name = "SignActions";
  private readonly errorHelper = new CommandErrorHelper<
    SignActionsCommandResponse,
    HyperliquidErrorCodes
  >(HYPERLIQUID_ERRORS, HyperliquidCommandErrorFactory);

  constructor(readonly args: SignActionsCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const signActionsArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x04,
      p1: 0x00,
      p2: 0x00,
    };

    const builder = new ApduBuilder(signActionsArgs);

    const path = DerivationPathUtils.splitPath(this.args.derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignActionsCommandResponse, HyperliquidErrorCodes> {
    const error = this.errorHelper.getError(response);
    if (error) {
      return error;
    }

    if (response.data.length === 0) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Unexpected data in response"),
      });
    }

    return CommandResultFactory({
      data: {
        signature: {
          r: response.data.slice(0, 32).toString(),
          s: response.data.slice(32, 64).toString(),
          v: response.data[64] ?? 0,
        },
      },
    });
  }
}
