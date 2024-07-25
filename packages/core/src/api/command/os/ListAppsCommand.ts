import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import { InvalidStatusWordError } from "@api/command/Errors";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { DeviceExchangeError } from "@api/Error";

// [SHOULD]: Device Error Response, maybe we want to group them together somewhere
// also might be worth to have other errors we could extends, eg: DeviceResponseError which could contain the error code
export class ConsentFailedError implements DeviceExchangeError {
  readonly _tag = "ConsentFailedError";
  originalError?: Error;
  errorCode: number = 0x5501;

  constructor() {
    this.originalError = new Error("Consent failed");
  }
}

export class PinNotValidated implements DeviceExchangeError {
  readonly _tag = "PinNotValidated";
  originalError?: Error;
  errorCode: number = 0x5502;

  constructor() {
    this.originalError = new Error("Pin not validated");
  }
}

export type AppResponse = {
  appEntryLength: number;
  appSizeInBlocks: number;
  appCodeHash: string;
  appFullHash: string;
  appName: string;
};

export type ListAppsResponse = AppResponse[];

export type ListAppsArgs = {
  isContinue: boolean;
};

export class ListAppsCommand
  implements Command<ListAppsResponse, ListAppsArgs>
{
  args: ListAppsArgs;

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

  parseResponse(apduResponse: ApduResponse): ListAppsResponse {
    const res: ListAppsResponse = [];
    const parser = new ApduParser(apduResponse);

    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      const statusCode = apduResponse.statusCode;

      // [SHOULD] Move this logic to common code error handling
      if (statusCode[0] === 0x55) {
        if (statusCode[1] === 0x01) {
          throw new ConsentFailedError();
        } else if (statusCode[1] === 0x02) {
          throw new PinNotValidated();
        }

        // [ASK] How de we handle unsuccessful responses?
        throw new InvalidStatusWordError(
          `Unexpected status word: ${parser.encodeToHexaString(apduResponse.statusCode)}`,
        );
      }

      // [ASK] How de we handle unsuccessful responses?
      throw new InvalidStatusWordError(
        `Unexpected status word: ${parser.encodeToHexaString(apduResponse.statusCode)}`,
      );
    }

    if (apduResponse.data.length <= 0) {
      return [];
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

    return res;
  }
}
