// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#sign-eth-eip-712
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

import { type Signature } from "@api/model/Signature";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

const R_LENGTH = 32;
const S_LENGTH = 32;

/**
 * Legacy implementation parameters. It is now replaced with prior calls to the following commands:
 *  - SendEIP712StructDefinitionCommand
 *  - SendEIP712StructImplemCommand
 *  - SendEIP712FilteringCommand
 */
export type SignEIP712CommandV0Args = {
  domainHash: string;
  messageHash: string;
};

export type SignEIP712CommandArgs = {
  readonly derivationPath: string;
  readonly legacyArgs: Maybe<SignEIP712CommandV0Args>;
};

export type SignEIP712CommandResponse = Signature;

export class SignEIP712Command
  implements
    Command<SignEIP712CommandResponse, SignEIP712CommandArgs, EthErrorCodes>
{
  private readonly errorHelper = new CommandErrorHelper<
    SignEIP712CommandResponse,
    EthErrorCodes
  >(ETH_APP_ERRORS, EthAppCommandErrorFactory);

  constructor(private readonly args: SignEIP712CommandArgs) {}

  getApdu(): Apdu {
    const { derivationPath, legacyArgs } = this.args;

    const signEIP712Args: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x0c,
      p1: 0x00,
      p2: legacyArgs.isJust() ? 0x00 : 0x01,
    };
    const paths = DerivationPathUtils.splitPath(derivationPath);
    const builder = new ApduBuilder(signEIP712Args);
    builder.add8BitUIntToData(paths.length);
    for (const path of paths) {
      builder.add32BitUIntToData(path);
    }

    legacyArgs.ifJust(({ domainHash, messageHash }) => {
      builder.addHexaStringToData(domainHash);
      builder.addHexaStringToData(messageHash);
    });

    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignEIP712CommandResponse, EthErrorCodes> {
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
