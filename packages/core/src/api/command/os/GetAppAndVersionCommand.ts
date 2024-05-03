import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import {
  InvalidResponseFormatError,
  InvalidStatusWordError,
} from "@api/command/Errors";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { ApduResponse } from "@internal/device-session/model/ApduResponse";

export type GetAppAndVersionResponse = {
  name: string;
  version: string;
  flags?: number | Uint8Array;
};

export class GetAppAndVersionCommand
  implements Command<GetAppAndVersionResponse>
{
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
      return { name, version } as GetAppAndVersionResponse;
    }

    const flags = parser.extractFieldLVEncoded();
    return { name, version, flags } as GetAppAndVersionResponse;
  }
}
