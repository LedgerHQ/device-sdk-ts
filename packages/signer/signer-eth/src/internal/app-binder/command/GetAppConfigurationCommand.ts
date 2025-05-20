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

import { type GetConfigCommandResponse as GetAppConfigurationCommandResponse } from "@api/app-binder/GetConfigCommandTypes";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

export class GetAppConfiguration
  implements Command<GetAppConfigurationCommandResponse, void, EthErrorCodes>
{
  readonly name = "GetAppConfigurationCommand";
  readonly args = undefined;
  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigurationCommandResponse,
    EthErrorCodes
  >(ETH_APP_ERRORS, EthAppCommandErrorFactory);

  constructor() {}

  getApdu(): Apdu {
    const getEthConfigArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x06,
      p1: 0x00,
      p2: 0x00,
    };
    const builder = new ApduBuilder(getEthConfigArgs);
    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAppConfigurationCommandResponse, EthErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      const configFlags = parser.extract8BitUInt();
      if (configFlags === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract config flags"),
        });
      }

      const major = parser.extract8BitUInt();
      const minor = parser.extract8BitUInt();
      const patch = parser.extract8BitUInt();

      if (major === undefined || minor === undefined || patch === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract version"),
        });
      }

      const blindSigningEnabled = !!(configFlags & 0x00000001);
      const web3ChecksEnabled = !!(configFlags & 0x00000010);
      const web3ChecksOptIn = !!(configFlags & 0x00000020);

      const data: GetAppConfigurationCommandResponse = {
        blindSigningEnabled,
        web3ChecksEnabled,
        web3ChecksOptIn,
        version: `${major}.${minor}.${patch}`,
      };

      return CommandResultFactory({
        data,
      });
    });
  }
}
