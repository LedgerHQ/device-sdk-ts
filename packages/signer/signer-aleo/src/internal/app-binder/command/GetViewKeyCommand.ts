import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
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
import { Maybe } from "purify-ts";

import {
  ALEO_APP_ERRORS,
  AleoAppCommandErrorFactory,
  type AleoErrorCodes,
} from "./utils/aleoApplicationErrors";

export type GetViewKeyCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetViewKeyCommandResponse = {
  readonly viewKey: string;
};

export class GetViewKeyCommand
  implements
    Command<GetViewKeyCommandResponse, GetViewKeyCommandArgs, AleoErrorCodes>
{
  readonly name = "GetViewKey";
  private readonly errorHelper = new CommandErrorHelper<
    GetViewKeyCommandResponse,
    AleoErrorCodes
  >(ALEO_APP_ERRORS, AleoAppCommandErrorFactory);

  private readonly args: GetViewKeyCommandArgs;

  constructor(args: GetViewKeyCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const getViewKeyCommandArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x07,
      p1: this.args.checkOnDevice ? 0x01 : 0x00,
      p2: 0x00,
    };

    const builder = new ApduBuilder(getViewKeyCommandArgs);
    const derivationPath = this.args.derivationPath;

    const path = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetViewKeyCommandResponse, AleoErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      const viewKeyLength = parser.extract8BitUInt();
      if (viewKeyLength === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Aleo view key length is missing"),
        });
      }

      if (parser.testMinimalLength(viewKeyLength) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("View key is missing"),
        });
      }

      const buffer = parser.extractFieldByLength(viewKeyLength);
      if (buffer === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Unable to extract view key"),
        });
      }

      const viewKey = parser.encodeToString(buffer);

      return CommandResultFactory({
        data: {
          viewKey,
        },
      });
    });
  }
}
