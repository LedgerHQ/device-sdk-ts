// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#provide-erc-20-token-information
import {
  Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
} from "@ledgerhq/device-sdk-core";

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
      ProvideTokenInformationCommandArgs
    >
{
  constructor(private readonly args: ProvideTokenInformationCommandArgs) {}

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
  ): CommandResult<ProvideTokenInformationCommandResponse> {
    const parser = new ApduParser(response);

    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }
    const tokenIndex = parser.extract8BitUInt() ?? 0;
    return CommandResultFactory({ data: { tokenIndex } });
  }
}
