import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  TEZOS_APP_ERRORS,
  TezosAppCommandErrorFactory,
  type TezosErrorCodes,
} from "./utils/tezosAppErrors";

const CLA = 0x80;
const INS_GET_VERSION = 0x00;

export type GetAppConfigCommandResponse = {
  version: string;
  bakingApp: boolean;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, TezosErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    TezosErrorCodes
  >(TEZOS_APP_ERRORS, TezosAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CLA,
      ins: INS_GET_VERSION,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, TezosErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);
        const responseLength = parser.getUnparsedRemainingLength();

        if (responseLength >= 4) {
          const appFlag = parser.extract8BitUInt();
          const major = parser.extract8BitUInt();
          const minor = parser.extract8BitUInt();
          const patch = parser.extract8BitUInt();

          if (
            appFlag !== undefined &&
            major !== undefined &&
            minor !== undefined &&
            patch !== undefined
          ) {
            return CommandResultFactory({
              data: {
                version: `${major}.${minor}.${patch}`,
                bakingApp: appFlag === 1,
              },
            });
          }
        }

        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract version"),
        });
      },
    );
  }
}
