// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#sign-eth-personal-message
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
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Just, Maybe, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { type ChunkableCommandArgs } from "@internal/app-binder/task/SendCommandInChunksTask";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";
const R_LENGTH = 32;
const S_LENGTH = 32;

export type SignPersonalMessageCommandResponse = Maybe<Signature>;

export class SignPersonalMessageCommand
  implements
    Command<
      SignPersonalMessageCommandResponse,
      ChunkableCommandArgs,
      EthErrorCodes
    >
{
  readonly name = "SignPersonalMessageCommand";

  private readonly errorHelper = new CommandErrorHelper<
    SignPersonalMessageCommandResponse,
    EthErrorCodes
  >(ETH_APP_ERRORS, EthAppCommandErrorFactory);

  constructor(readonly args: ChunkableCommandArgs) {}

  getApdu(): Apdu {
    const { chunkedData, isFirstChunk } = this.args;
    const signPersonalMessageArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x08,
      p1: isFirstChunk ? 0x00 : 0x80,
      p2: 0x00,
    };

    return new ApduBuilder(signPersonalMessageArgs)
      .addBufferToData(chunkedData)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignPersonalMessageCommandResponse, EthErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      // The data is returned only for the last chunk
      const v = parser.extract8BitUInt();
      if (v === undefined) {
        return CommandResultFactory({ data: Nothing });
      }

      const r = parser.encodeToHexaString(
        parser.extractFieldByLength(R_LENGTH),
        true,
      );
      if (!r) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("R is missing"),
        });
      }

      const s = parser.encodeToHexaString(
        parser.extractFieldByLength(S_LENGTH),
        true,
      );
      if (!s) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("S is missing"),
        });
      }

      return CommandResultFactory({
        data: Just({
          r,
          s,
          v,
        }),
      });
    });
  }
}
