// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#provide-erc-20-token-information
import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

export type ProvideTokenInformationCommandArgs = {
  payload: string;
};

export type ProvideTokenInformationCommandResponse = {
  tokenIndex: number;
};

export class ProvideTokenInformationCommand
  implements
    Command<
      ProvideTokenInformationCommandResponse,
      ProvideTokenInformationCommandArgs,
      EthErrorCodes
    >
{
  readonly name = "ProvideTokenInformationCommand";

  private readonly errorHelper = new CommandErrorHelper<
    ProvideTokenInformationCommandResponse,
    EthErrorCodes
  >(ETH_APP_ERRORS, EthAppCommandErrorFactory);

  constructor(readonly args: ProvideTokenInformationCommandArgs) {}

  getApdu(): Apdu {
    const getEthAddressArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x0a,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(getEthAddressArgs)
      .addHexaStringToData(this.args.payload)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<ProvideTokenInformationCommandResponse, EthErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);
      const tokenIndex = parser.extract8BitUInt() ?? 0;
      return CommandResultFactory({ data: { tokenIndex } });
    });
  }
}
