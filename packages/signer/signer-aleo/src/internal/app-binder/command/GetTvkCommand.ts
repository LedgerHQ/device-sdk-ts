import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidResponseFormatError,
} from "@ledgerhq/device-management-kit";
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ALEO_CLA,
  INS,
  P1,
  P2_DEFAULT,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

import {
  ALEO_APP_ERRORS,
  AleoAppCommandErrorFactory,
  type AleoErrorCodes,
} from "./utils/aleoApplicationErrors";

export type GetTvkCommandArgs = {
  readonly derivationPath: string;
  readonly transitionIndex?: number;
};

export type GetTvkCommandResponse = {
  readonly tvk: Uint8Array;
};

export class GetTvkCommand
  implements Command<GetTvkCommandResponse, GetTvkCommandArgs, AleoErrorCodes>
{
  readonly name = "getTvk";
  private readonly errorHelper = new CommandErrorHelper<
    GetTvkCommandResponse,
    AleoErrorCodes
  >(ALEO_APP_ERRORS, AleoAppCommandErrorFactory);

  private readonly args: GetTvkCommandArgs;

  constructor(args: GetTvkCommandArgs) {
    this.args = args;
  }

  private assertValidTransitionIndex(index: number): void {
    if (!Number.isInteger(index) || index < 1 || index > 31) {
      throw new InvalidResponseFormatError(
        `transitionIndex must be an integer in [1, 31], got ${index}`,
      );
    }
  }

  getApdu(): Apdu {
    const { transitionIndex } = this.args;
    const isIndexed = transitionIndex !== undefined;

    if (transitionIndex !== undefined) {
      this.assertValidTransitionIndex(transitionIndex);
    }

    const getTvkArgs: ApduBuilderArgs = {
      cla: ALEO_CLA,
      ins: INS.GET_TVK,
      p1: isIndexed ? P1.GET_TVK_INDEXED : P1.GET_TVK_ROOT,
      p2: P2_DEFAULT,
    };

    const builder = new ApduBuilder(getTvkArgs);
    const path = DerivationPathUtils.splitPath(this.args.derivationPath);

    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    if (transitionIndex !== undefined) {
      builder.add8BitUIntToData(transitionIndex);
    }

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetTvkCommandResponse, AleoErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      const tvkLength = parser.extract8BitUInt();
      if (tvkLength === undefined) {
        return CommandResultFactory({
          error: new InvalidResponseFormatError("Aleo TVK length is missing"),
        });
      }

      if (parser.testMinimalLength(tvkLength) === false) {
        return CommandResultFactory({
          error: new InvalidResponseFormatError("TVK is missing"),
        });
      }

      const tvk = parser.extractFieldByLength(tvkLength);
      if (tvk === undefined) {
        return CommandResultFactory({
          error: new InvalidResponseFormatError("Unable to extract TVK"),
        });
      }

      return CommandResultFactory({
        data: { tvk },
      });
    });
  }
}
