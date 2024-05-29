import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import { InvalidStatusWordError } from "@api/command/Errors";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { DeviceModelId } from "@api/device/DeviceModel";
import { ApduResponse } from "@api/device-session/ApduResponse";

/**
 * Response of the GetOsVersionCommand.
 */
export type GetOsVersionResponse = {
  /**
   * Target identifier.
   */
  targetId: string;

  /**
   * Version of BOLOS on the secure element (SE).
   * {@link https://developers.ledger.com/docs/device-app/architecture/bolos/hardware-architecture | Hardware Architecture}
   */
  seVersion: string;

  /**
   * Secure element flags.
   * Used to represent the current state of the secure element.
   */
  seFlags: number;

  /**
   * Version of the microcontroller unit (MCU) SEPH, which is the SE-MCU link protocol.
   * {@link https://developers.ledger.com/docs/device-app/architecture/bolos/hardware-architecture | Hardware Architecture}
   */
  mcuSephVersion: string;

  /**
   * Version of the MCU bootloader.
   */
  mcuBootloaderVersion: string;

  /**
   * Hardware revision version.
   * Only available for Ledger Nano X in which case it's "00" or "01".
   */
  hwVersion: string;

  /**
   * Identifier of the installed language pack.
   * Can be one of:
   * - "00": English
   * - "01": French
   * - "02": Spanish
   */
  langId: string; // [SHOULD] be an enum

  /**
   * State for Ledger Recover. // [SHOULD] Add more information about this field
   */
  recoverState: string;
};

/**
 * Command to get information about the device firmware.
 */
export class GetOsVersionCommand implements Command<GetOsVersionResponse> {
  getApdu(): Apdu {
    const getOsVersionApduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x01,
      p1: 0x00,
      p2: 0x00,
    } as const;
    return new ApduBuilder(getOsVersionApduArgs).build();
  }

  parseResponse(responseApdu: ApduResponse, deviceModelId: DeviceModelId) {
    const parser = new ApduParser(responseApdu);
    if (!CommandUtils.isSuccessResponse(responseApdu)) {
      // [ASK] How de we handle unsuccessful responses?
      throw new InvalidStatusWordError(
        `Unexpected status word: ${parser.encodeToHexaString(responseApdu.statusCode)}`,
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
