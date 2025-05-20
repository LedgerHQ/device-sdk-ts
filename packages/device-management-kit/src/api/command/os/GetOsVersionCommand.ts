import { coerce, gte } from "semver";

import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, type ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { type Command } from "@api/command/Command";
import { InvalidStatusWordError } from "@api/command/Errors";
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
   * Indicated if the device is running in bootloader mode.
   * It can happens during a firmware update process.
   */
  readonly isBootloader: boolean;

  /**
   * Indicated if the device firmware is an OS Updater (OSU).
   * It can happens during a firmware update process.
   */
  readonly isOsu: boolean;

  /**
   * Target identifier.
   */
  readonly targetId: number;

  /**
   * Target identifier of the secure element.
   * Not always available when the device is in bootloader mode.
   */
  readonly seTargetId: number | undefined;

  /**
   * Target identifier of the microcontroller unit (MCU).
   * Only available when the device is in bootloader mode.
   */
  readonly mcuTargetId: number | undefined;

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
   * - "03": Portuguese
   * - "04": German
   * - "05": Russian
   * - "06": Turkish
   */
  readonly langId: number | undefined;

  /**
   * State for Ledger Recover. // [SHOULD] Add more information about this field
   */
  readonly recoverState: number | undefined;

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
  readonly name = "GetOsVersionCommand";
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
    const targetId = parser.extract32BitUInt();
    if (targetId === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Missing target ID in OS version"),
      });
    }

    let version = parser.encodeToString(parser.extractFieldLVEncoded());
    let seFlags = parser.extractFieldLVEncoded() ?? new Uint8Array(0);
    const seFlagsParser = new SecureElementFlagsParser(seFlags);
    // This is the parsed secure element flags.
    const secureElementFlags = { ...seFlagsParser.generalDeviceState() };

    // Handle old firmwares with no version
    if (!version) {
      version = "0.0.0";
      seFlags = new Uint8Array();
    }

    const isBootloader = (targetId & 0xf0000000) !== 0x30000000;
    const isOsu = version.includes("-osu");
    let seVersion: string = "";
    let mcuSephVersion: string = "";
    let mcuBootloaderVersion: string = "";
    let hwVersion: string = "";
    let mcuTargetId: number | undefined = undefined;
    let seTargetId: number | undefined = undefined;
    let langId: number | undefined = undefined;
    let recoverState: number | undefined = undefined;

    if (isBootloader) {
      mcuBootloaderVersion = version;
      mcuTargetId = targetId;

      const seData = parser.extractFieldLVEncoded();
      if (seData) {
        if (seData.length >= 5) {
          // It means it's a version followed by the seTargetId
          seVersion = parser.encodeToString(seData);
          seTargetId = parseInt(
            parser.encodeToHexaString(parser.extractFieldLVEncoded()),
            16,
          );
        } else {
          // It's the seTargetId
          seTargetId = parseInt(parser.encodeToHexaString(seData), 16);
        }
      }
    } else {
      seVersion = version;
      seTargetId = targetId;

      mcuSephVersion = parser.encodeToString(parser.extractFieldLVEncoded());

      if (this.isBootloaderVersionSupported(seVersion, deviceModelId)) {
        mcuBootloaderVersion = parser.encodeToString(
          parser.extractFieldLVEncoded(),
        );
      }

      if (this.isHardwareVersionSupported(seVersion, deviceModelId)) {
        hwVersion = parser.encodeToHexaString(parser.extractFieldLVEncoded());
      } else {
        hwVersion = "00";
      }

      if (this.isLocalizationSupported(seVersion, deviceModelId)) {
        const langIdBuffer = parser.extractFieldLVEncoded();
        if (langIdBuffer !== undefined) {
          langId = parseInt(parser.encodeToHexaString(langIdBuffer), 16);
        }
      }

      if (this.isRecoverSupported(seVersion, deviceModelId)) {
        const recoverStateBuffer = parser.extractFieldLVEncoded();
        if (recoverStateBuffer !== undefined) {
          recoverState = parseInt(
            parser.encodeToHexaString(recoverStateBuffer),
            16,
          );
        }
      }
    }

    return CommandResultFactory({
      data: {
        isBootloader,
        isOsu,
        targetId,
        seTargetId,
        mcuTargetId,
        seVersion,
        seFlags,
        mcuSephVersion,
        mcuBootloaderVersion,
        hwVersion,
        langId,
        recoverState,
        secureElementFlags,
      },
    });
  }

  private isBootloaderVersionSupported(
    seVersion: string,
    deviceModelId: DeviceModelId,
  ): boolean {
    const version = coerce(seVersion) ?? "";
    switch (deviceModelId) {
      case DeviceModelId.NANO_S:
      case DeviceModelId.NANO_X:
        return gte(version, "2.0.0");
      default:
        return true;
    }
  }

  private isHardwareVersionSupported(
    seVersion: string,
    deviceModelId: DeviceModelId,
  ): boolean {
    const version = coerce(seVersion) ?? "";
    switch (deviceModelId) {
      case DeviceModelId.NANO_X:
        return gte(version, "2.0.0");
      default:
        return false;
    }
  }

  private isLocalizationSupported(
    seVersion: string,
    deviceModelId: DeviceModelId,
  ): boolean {
    const version = coerce(seVersion) ?? "";
    switch (deviceModelId) {
      case DeviceModelId.NANO_S:
        return false;
      case DeviceModelId.NANO_SP:
        return gte(version, "1.1.0");
      case DeviceModelId.NANO_X:
        return gte(version, "2.1.0");
      default:
        return true;
    }
  }

  private isRecoverSupported(
    seVersion: string,
    deviceModelId: DeviceModelId,
  ): boolean {
    const version = coerce(seVersion) ?? "";
    switch (deviceModelId) {
      case DeviceModelId.NANO_S:
        return false;
      case DeviceModelId.NANO_SP:
        return gte(version, "1.1.2");
      case DeviceModelId.NANO_X:
        return gte(version, "2.2.3");
      case DeviceModelId.STAX:
        return gte(version, "1.4.0");
      case DeviceModelId.FLEX:
        return gte(version, "1.0.1");
      default:
        return true;
    }
  }
}
