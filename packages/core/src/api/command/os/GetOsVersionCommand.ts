import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import { ApduResponse } from "@internal/device-session/model/ApduResponse";

type GetOsVersionResponse = {
  targetId: number;
  seVersion: Uint8Array;
  seFlags: Uint8Array;
  mcuSephVersion: Uint8Array;
  mcuBootloaderVersion: Uint8Array;
  hwVersion?: Uint8Array;
  langId: Uint8Array;
  recoverState?: Uint8Array;
  sw: Uint8Array;
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

  parseResponse(responseApdu: ApduResponse) {
    const sw = responseApdu.statusCode;

    if (!this.isSuccess(sw)) {
      throw new Error(`Unexpected status word: ${sw.toString()}`);
    }

    const parser = new ApduParser(responseApdu);

    // [ASK] Do we want to parse the value directly ?
    // eg: const targetId = parser.encodeToString(parser.extract32BitUInt());
    const targetId = parser.extract32BitUInt()!;
    const seVersion = parser.extractFieldLVEncoded()!;
    const seFlags = parser.extractFieldLVEncoded()!;
    const mcuSephVersion = parser.extractFieldLVEncoded()!;
    const mcuBootloaderVersion = parser.extractFieldLVEncoded()!;

    // [ASK] hwVersion is LNX only, does it mean that we should skip this step
    // if we are not on LNX and continue with the other fields?
    const hwVersion = parser.extractFieldLVEncoded();
    const langId = parser.extractFieldLVEncoded()!;
    const recoverState = parser.extractFieldLVEncoded();

    return {
      targetId,
      seVersion,
      seFlags,
      mcuSephVersion,
      mcuBootloaderVersion,
      hwVersion,
      langId,
      recoverState,
      sw,
    };
  }

  private isSuccess(statusWord: Uint8Array) {
    if (statusWord.length !== 2) {
      return false;
    }
    return statusWord[0] === 0x90 && statusWord[1] === 0x00;
  }
}
