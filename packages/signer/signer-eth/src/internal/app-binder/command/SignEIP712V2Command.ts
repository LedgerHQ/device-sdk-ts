// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/apdu.md#sign-eth-eip-712
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
import { Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

const R_LENGTH = 32;
const S_LENGTH = 32;

export type SignEIP712V2CommandResponse = Signature;

/**
 * Closes an EIP-712 V2 flow by asking the app to sign the message it already holds.
 *
 * The command carries no input data: the derivation path travelled inside the
 * EIP712_VALUES payload, and the app rejects a non-empty Lc. It only succeeds once the
 * schema and the values have both been delivered, and it consumes the message.
 */
export class SignEIP712V2Command
  implements Command<SignEIP712V2CommandResponse, void, EthErrorCodes>
{
  readonly name = "signEIP712V2";
  private readonly errorHelper = new CommandErrorHelper<
    SignEIP712V2CommandResponse,
    EthErrorCodes
  >(ETH_APP_ERRORS, EthAppCommandErrorFactory);

  getApdu(): Apdu {
    const signEIP712V2Args: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x0c,
      p1: 0x00,
      p2: 0x02,
    };

    return new ApduBuilder(signEIP712V2Args).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignEIP712V2CommandResponse, EthErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

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
        data: {
          r,
          s,
          v,
        },
      });
    });
  }
}
