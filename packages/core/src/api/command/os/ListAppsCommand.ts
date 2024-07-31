import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import { GlobalErrorHandler } from "@api/command/Errors";
import {
  CommandResult,
  CommandResultFactory,
  CommandResultStatus,
} from "@api/command/model/CommandResult";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { GlobalCommandErrorStatusCode } from "@api/Error";

// [SHOULD]: Device Error Response, maybe we want to group them together somewhere
// also might be worth to have other errors we could extends, eg: DeviceResponseError which could contain the error code
// export class ConsentFailedError implements DeviceExchangeError {
//   readonly _tag = "ConsentFailedError";
//   readonly originalError?: Error;
//   readonly errorCode: number = 0x5501;
//
//   constructor() {
//     this.originalError = new Error("Consent failed");
//   }
// }
//
// export class PinNotValidated implements DeviceExchangeError {
//   readonly _tag = "PinNotValidated";
//   readonly originalError?: Error;
//   readonly errorCode: number = 0x5502;
//
//   constructor() {
//     this.originalError = new Error("Pin not validated");
//   }
// }

export type AppResponse = {
  readonly appEntryLength: number;
  readonly appSizeInBlocks: number;
  readonly appCodeHash: string;
  readonly appFullHash: string;
  readonly appName: string;
};

export type ListAppsResponse = AppResponse[];

export type ListAppsArgs = {
  readonly isContinue: boolean;
};

export class ListAppsCommand
  implements Command<ListAppsResponse, ListAppsArgs>
{
  readonly args: ListAppsArgs;

  constructor(args = { isContinue: false }) {
    this.args = args;
  }

  getApdu(): Apdu {
    const listAppApduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: this.args.isContinue ? 0xdf : 0xde,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(listAppApduArgs).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<ListAppsResponse, GlobalCommandErrorStatusCode> {
    const res: ListAppsResponse = [];
    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        status: CommandResultStatus.Error,
        error: GlobalErrorHandler.handle(apduResponse),
      });
    }
    const parser = new ApduParser(apduResponse);

    if (apduResponse.data.length <= 0) {
      return CommandResultFactory({
        data: [],
        status: CommandResultStatus.Success,
      });
    }

    // [NOTE] version of parsing, not used for now, skipping 1 byte
    parser.extract8BitUInt()!;

    while (parser.getUnparsedRemainingLength() > 0) {
      const appEntryLength = parser.extract8BitUInt()!;
      const appSizeInBlocks = parser.extract16BitUInt()!;
      parser.extract16BitUInt()!; // Skip 2 bytes (flags, missing in doc for now)
      const appCodeHash = parser.encodeToHexaString(
        parser.extractFieldByLength(0x20), // 32 bytes
      );
      const appFullHash = parser.encodeToHexaString(
        parser.extractFieldByLength(0x20), // 32 bytes
      );

      const appName = parser.encodeToString(parser.extractFieldLVEncoded());

      res.push({
        appEntryLength,
        appSizeInBlocks,
        appCodeHash,
        appFullHash,
        appName,
      });
    }

    return CommandResultFactory({
      data: res,
      status: CommandResultStatus.Success,
    });
  }
}
