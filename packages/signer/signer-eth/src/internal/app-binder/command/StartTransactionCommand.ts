// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#sign-eth-transaction
// https://github.com/LedgerHQ/generic_parser/blob/master/specs.md#sign (to be removed when the top link has been updated)
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
import { Just, Maybe } from "purify-ts";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";
import { type SignTransactionCommandResponse } from "./SignTransactionCommand";

const R_LENGTH = 32;
const S_LENGTH = 32;

/**
 * StartTransactionCommand is a SignTransactionCommand that is used to sign the transaction.
 * It signature differs from the SignTransactionCommand because
 * the command does not need a Transaction to be provided.
 */
export class StartTransactionCommand
  implements Command<SignTransactionCommandResponse, void, EthErrorCodes>
{
  readonly args = undefined;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    EthErrorCodes
  >(ETH_APP_ERRORS, EthAppCommandErrorFactory);

  getApdu(): Apdu {
    const signEthTransactionArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x04,
      p1: 0x00,
      p2: 0x02,
    };
    const builder = new ApduBuilder(signEthTransactionArgs);
    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, EthErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      // The data is returned only for the last chunk
      const v = parser.extract8BitUInt();
      if (v === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("V is missing"),
        });
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
          v,
          r,
          s,
        }),
      });
    });
  }
}
