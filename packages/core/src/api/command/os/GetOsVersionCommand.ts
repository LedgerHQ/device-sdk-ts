import { Just } from "purify-ts";

import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { DeviceModelId } from "@api/types";
import { ApduResponse } from "@internal/device-session/model/ApduResponse";

export type GetOsVersionResponse = {
  targetId: string;
  seVersion: string;
  seFlags: number;
  mcuSephVersion: string;
  mcuBootloaderVersion: string;
  hwVersion: string;
  langId: string;
  recoverState: string;
};

export class GetOsVersionCommand
  implements Command<void, GetOsVersionResponse>
{
  getApdu = (): Apdu =>
    new ApduBuilder({
      cla: 0xe0,
      ins: 0x01,
      p1: 0x00,
      p2: 0x00,
    }).build();

  parseResponse(responseApdu: ApduResponse, deviceModelId: DeviceModelId) {
    const parser = new ApduParser(responseApdu);
    if (!CommandUtils.isSuccessResponse(responseApdu)) {
      // [ASK] How de we handle unsuccessful responses?
      throw new Error(
        `Unexpected status word: ${parser.encodeToHexaString(Just(responseApdu.statusCode))}`,
      );
    }

    const targetId = parser.encodeToHexaString(parser.extractFieldByLength(4));
    const seVersion = parser.encodeToString(parser.extractFieldLVEncoded());
    const seFlags = parseInt(
      parser.encodeToHexaString(parser.extractFieldLVEncoded()).toString(),
      16,
    );
    const mcuSephVersion = parser.encodeToString(
      parser.extractFieldLVEncoded(),
    );
    const mcuBootloaderVersion = parser.encodeToString(
      parser.extractFieldLVEncoded(),
    );

    let hwVersion = "00";
    if (deviceModelId === DeviceModelId.NANO_X) {
      hwVersion = parser.encodeToHexaString(parser.extractFieldLVEncoded());
    }

    const langId = parser.encodeToHexaString(parser.extractFieldLVEncoded());
    const recoverState = parser.encodeToHexaString(
      parser.extractFieldLVEncoded(),
    );

    return {
      targetId,
      seVersion,
      seFlags,
      mcuSephVersion,
      mcuBootloaderVersion,
      hwVersion,
      langId,
      recoverState: recoverState ? recoverState : "0",
    };
  }
}
