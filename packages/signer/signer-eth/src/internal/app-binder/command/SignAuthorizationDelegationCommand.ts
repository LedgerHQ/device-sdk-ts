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

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

const R_LENGTH = 32;
const S_LENGTH = 32;

export type SignEIP7702AuthorizationCommandArgs = {
  /**
   * The data to sign in max 150 bytes chunks
   * Data is a concatenation of the following:
   * - Derivation path length (1 byte)
   * - Derivation path (4 bytes per element)
   * - Nonce (4 bytes)
   * - Chain ID (4 bytes)
   * - Address (20 bytes)
   */
  readonly data: Uint8Array;
  /**
   * If this is the first chunk of the message
   */
  readonly isFirstChunk: boolean;
};

export type SignEIP7702AuthorizationCommandResponse = Maybe<Signature>;

export class SignEIP7702AuthorizationCommand
  implements
    Command<
      SignEIP7702AuthorizationCommandResponse,
      SignEIP7702AuthorizationCommandArgs,
      EthErrorCodes
    >
{
  readonly args: SignEIP7702AuthorizationCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignEIP7702AuthorizationCommandResponse,
    EthErrorCodes
  >(ETH_APP_ERRORS, EthAppCommandErrorFactory);

  constructor(args: SignEIP7702AuthorizationCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { data, isFirstChunk } = this.args;
    const signEIP7702AuthorizationArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x34,
      p1: isFirstChunk ? 0x00 : 0x01,
      p2: 0x00,
    };

    return new ApduBuilder(signEIP7702AuthorizationArgs)
      .addBufferToData(data)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignEIP7702AuthorizationCommandResponse, EthErrorCodes> {
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
