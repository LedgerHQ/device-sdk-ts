import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import {
  InvalidResponseFormatError,
  InvalidStatusWordError,
} from "@api/command/Errors";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { ApduResponse } from "@api/device-session/ApduResponse";

export type GetAppAndVersionResponse = {
  /**
   * The name of the application currently running on the device.
   */
  name: string;
  /**
   * The version of the application currently running on the device.
   */
  version: string;
  flags?: number | Uint8Array;
};

/**
 * Command to get information about the application currently running on the
 * device.
 */
export class GetAppAndVersionCommand
  implements Command<GetAppAndVersionResponse>
{
  args = undefined;

  getApdu(): Apdu {
    const getAppAndVersionApduArgs: ApduBuilderArgs = {
      cla: 0xb0,
      ins: 0x01,
      p1: 0x00,
      p2: 0x00,
    } as const;
    return new ApduBuilder(getAppAndVersionApduArgs).build();
  }

  parseResponse(apduResponse: ApduResponse): GetAppAndVersionResponse {
    const parser = new ApduParser(apduResponse);
    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      throw new InvalidStatusWordError(
        `Unexpected status word: ${parser.encodeToHexaString(
          apduResponse.statusCode,
        )}`,
      );
    }

    if (parser.extract8BitUint() !== 1) {
      throw new InvalidResponseFormatError(
        "getAppAndVersion: format not supported",
      );
    }

    const name = parser.encodeToString(parser.extractFieldLVEncoded());
    const version = parser.encodeToString(parser.extractFieldLVEncoded());

    if (parser.getUnparsedRemainingLength() === 0) {
      return { name, version };
    }

    const flags = parser.extractFieldLVEncoded();
    return { name, version, flags };
  }
}