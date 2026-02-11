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
  STELLAR_APP_ERRORS,
  StellarAppCommandErrorFactory,
  type StellarErrorCodes,
} from "./utils/stellarAppErrors";

const CLA = 0xe0;
const INS_GET_CONF = 0x06;

export type GetAppConfigCommandResponse = {
  version: string;
  hashSigningEnabled: boolean;
  maxDataSize?: number;
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, StellarErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    StellarErrorCodes
  >(STELLAR_APP_ERRORS, StellarAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CLA,
      ins: INS_GET_CONF,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, StellarErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        const hashSigningEnabled = parser.extract8BitUInt();
        const major = parser.extract8BitUInt();
        const minor = parser.extract8BitUInt();
        const patch = parser.extract8BitUInt();

        if (
          hashSigningEnabled === undefined ||
          major === undefined ||
          minor === undefined ||
          patch === undefined
        ) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract app configuration"),
          });
        }

        // Optional max data size (2 bytes)
        let maxDataSize: number | undefined;
        if (parser.getUnparsedRemainingLength() >= 2) {
          const hi = parser.extract8BitUInt();
          const lo = parser.extract8BitUInt();
          if (hi !== undefined && lo !== undefined) {
            // eslint-disable-next-line no-bitwise
            maxDataSize = (hi << 8) | lo;
          }
        }

        return CommandResultFactory({
          data: {
            version: `${major}.${minor}.${patch}`,
            hashSigningEnabled: hashSigningEnabled === 0x01,
            maxDataSize,
          },
        });
      },
    );
  }
}
