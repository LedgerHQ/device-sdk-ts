// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#provide-nft-information
import {
  Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  type Command,
  CommandErrorArgs,
  CommandErrors,
  CommandResult,
  CommandResultFactory,
  CommandUtils,
  DeviceExchangeError,
  GlobalCommandErrorHandler,
  isCommandErrorCode,
} from "@ledgerhq/device-sdk-core";

export type ProvideNFTInformationCommandArgs = {
  /**
   * The stringified hexa representation of the NFT data.
   */
  data: string;
};

export type ProvideNFTInformationCommandErrorCodes = "6d00";

const PROVIDE_NFT_INFO_ERRORS: CommandErrors<ProvideNFTInformationCommandErrorCodes> =
  {
    "6d00": { message: "ETH app is not up to date" },
  };

class ProvideNFTInformationCommandError extends DeviceExchangeError<ProvideNFTInformationCommandErrorCodes> {
  constructor(args: CommandErrorArgs<ProvideNFTInformationCommandErrorCodes>) {
    super({ ...args, tag: "ProvideNFTInformationCommandError" });
  }
}

export class ProvideNFTInformationCommand
  implements
    Command<
      void,
      ProvideNFTInformationCommandErrorCodes,
      ProvideNFTInformationCommandArgs
    >
{
  constructor(private args: ProvideNFTInformationCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x14,
      p1: 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduBuilderArgs)
      .addHexaStringToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<void, ProvideNFTInformationCommandErrorCodes> {
    if (CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({ data: undefined });
    }
    const parser = new ApduParser(response);
    const errorCode = parser.encodeToHexaString(response.statusCode);

    if (isCommandErrorCode(errorCode, PROVIDE_NFT_INFO_ERRORS)) {
      return CommandResultFactory({
        error: new ProvideNFTInformationCommandError({
          ...PROVIDE_NFT_INFO_ERRORS[errorCode],
          errorCode,
        }),
      });
    }

    return CommandResultFactory({
      error: GlobalCommandErrorHandler.handle(response),
    });
  }
}
