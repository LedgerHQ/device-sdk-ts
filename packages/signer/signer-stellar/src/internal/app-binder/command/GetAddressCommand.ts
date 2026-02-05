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
import { CommandErrorHelper, DerivationPathUtils } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  STELLAR_APP_ERRORS,
  StellarAppCommandErrorFactory,
  type StellarErrorCodes,
} from "./utils/stellarAppErrors";

const CLA = 0xe0;
const INS_GET_PK = 0x02;
const P1_FIRST = 0x00;
const P2_NON_CONFIRM = 0x00;
const P2_CONFIRM = 0x01;

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: Uint8Array;
};

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, StellarErrorCodes>
{
  readonly name = "GetAddress";

  private readonly _args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    StellarErrorCodes
  >(STELLAR_APP_ERRORS, StellarAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, checkOnDevice } = this._args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS_GET_PK,
      p1: P1_FIRST,
      p2: checkOnDevice ? P2_CONFIRM : P2_NON_CONFIRM,
    });

    // Build path: paths_count (1 byte) + paths (4 bytes each)
    const paths = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(paths.length);
    paths.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, StellarErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // Response: raw public key (32 bytes for Ed25519)
        const publicKey = parser.extractFieldByLength(32);

        if (publicKey === undefined) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Cannot extract public key"),
          });
        }

        return CommandResultFactory({
          data: {
            publicKey,
          },
        });
      },
    );
  }
}
