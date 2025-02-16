import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, type ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { type Command } from "@api/command/Command";
import {
  type CommandResult,
  CommandResultFactory,
} from "@api/command/model/CommandResult";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { GlobalCommandErrorHandler } from "@api/command/utils/GlobalCommandError";
import { DeviceModelId } from "@api/device/DeviceModel";
import {
  type DeviceGeneralState,
  type EndorsementInformation,
  type OnboardingStatus,
  type WordsInformation,
} from "@api/device/SecureElementFlags";
import { type ApduResponse } from "@api/device-session/ApduResponse";

import { SecureElementFlagsParser } from "./SecureElementFlagsParser";

/**
 * Response of the GetOsVersionCommand.
 */
export type GetOsVersionResponse = {
  /**
   * Target identifier.
   */
  readonly targetId: number;

  /**
   * Version of BOLOS on the secure element (SE).
   * {@link https://developers.ledger.com/docs/device-app/architecture/bolos/hardware-architecture | Hardware Architecture}
   */
  readonly seVersion: string;

  /**
   * Secure element flags.
   * Used to represent the current state of the secure element.
   */
  readonly seFlags: Uint8Array;

  /**
   * Version of the microcontroller unit (MCU) SEPH, which is the SE-MCU link protocol.
   * {@link https://developers.ledger.com/docs/device-app/architecture/bolos/hardware-architecture | Hardware Architecture}
   */
  readonly mcuSephVersion: string;

  /**
   * Version of the MCU bootloader.
   */
  readonly mcuBootloaderVersion: string;

  /**
   * Hardware revision version.
   * Only available for Ledger Nano X in which case it's "00" or "01".
   */
  readonly hwVersion: string;

  /**
   * Identifier of the installed language pack.
   * Can be one of:
   * - "00": English
   * - "01": French
   * - "02": Spanish
   */
  readonly langId: string; // [SHOULD] be an enum

  /**
   * State for Ledger Recover. // [SHOULD] Add more information about this field
   */
  readonly recoverState: string;

  /**
   * The parsed secure element flags.
   */
  readonly secureElementFlags: DeviceGeneralState &
    EndorsementInformation &
    WordsInformation &
    OnboardingStatus;
};

export type GetOsVersionCommandResult = CommandResult<GetOsVersionResponse>;

/**
 * Command to get information about the device firmware.
 */
export class GetOsVersionCommand implements Command<GetOsVersionResponse> {
  readonly args = undefined;

  getApdu(): Apdu {
    const getOsVersionApduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x01,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(getOsVersionApduArgs).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
    deviceModelId: DeviceModelId,
  ): GetOsVersionCommandResult {
    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }
    const parser = new ApduParser(apduResponse);

    const targetId = parseInt(
      parser.encodeToHexaString(parser.extractFieldByLength(4)),
      16,
    );
    const seVersion = parser.encodeToString(parser.extractFieldLVEncoded());
    const seFlags = parser.extractFieldLVEncoded() ?? new Uint8Array(0);
    const seFlagsParser = new SecureElementFlagsParser(seFlags);
    // This is the parsed secure element flags.
    const secureElementFlags = { ...seFlagsParser.generalDeviceState() };

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

    return CommandResultFactory({
      data: {
        targetId,
        seVersion,
        seFlags,
        mcuSephVersion,
        mcuBootloaderVersion,
        hwVersion,
        langId,
        recoverState: recoverState ? recoverState : "0",
        secureElementFlags,
      },
    });
  }
}
