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

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetAddressCommandResponse = {
  readonly address: string;
};

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, AleoErrorCodes>
{
  readonly name = "GetAddress";
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    AleoErrorCodes
  >(ALEO_APP_ERRORS, AleoAppCommandErrorFactory);

  private readonly args: GetAddressCommandArgs;

  constructor(args: GetAddressCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const getAddressCommandArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x05,
      p1: this.args.checkOnDevice ? 0x01 : 0x00,
      p2: 0x00,
    };

    const builder = new ApduBuilder(getAddressCommandArgs);
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
  ): CommandResult<GetAddressCommandResponse, AleoErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      const addressLength = parser.extract8BitUInt();
      if (addressLength === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Aleo address length is missing"),
        });
      }

      if (parser.testMinimalLength(addressLength) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Public key is missing"),
        });
      }

      const buffer = parser.extractFieldByLength(addressLength);
      if (buffer === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Unable to extract public key"),
        });
      }

      const address = parser.encodeToString(buffer);

      return CommandResultFactory({
        data: {
          address,
        },
      });
    });
  }
}
