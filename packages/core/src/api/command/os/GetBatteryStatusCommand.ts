import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import {
  InvalidBatteryDataError,
  InvalidBatteryFlagsError,
  InvalidBatteryStatusTypeError,
  InvalidStatusWordError,
} from "@api/command/Errors";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { ApduResponse } from "@api/device-session/ApduResponse";

/**
 * The type of battery information to retrieve.
 */
export enum BatteryStatusType {
  /**
   * The command response will be the battery percentage.
   */
  BATTERY_PERCENTAGE = 0x00,
  /**
   * The command response will be the battery voltage in mV.
   */
  BATTERY_VOLTAGE = 0x01,
  /**
   * The command response will be the battery temperature in degree celsius
   */
  BATTERY_TEMPERATURE = 0x02,
  /**
   * The command response will be the battery current in mA.
   */
  BATTERY_CURRENT = 0x03,
  /**
   * The command response will be the battery status (cf. `BatteryStatusFlags`)
   */
  BATTERY_FLAGS = 0x04,
}

export enum ChargingMode {
  NONE = 0x00,
  USB = 0x01,
  QI = 0x02,
}

enum FlagMasks {
  CHARGING = 0x00000001,
  USB = 0x00000002,
  USB_POWERED = 0x00000008,
  BLE = 0x00000004,
  ISSUE_BATTERY = 0x00000080,
  ISSUE_CHARGING = 0x00000010,
  ISSUE_TEMPERATURE = 0x00000020,
}

type BatteryStatusFlags = {
  charging: ChargingMode;
  issueCharging: boolean;
  issueTemperature: boolean;
  issueBattery: boolean;
};

/**
 * The response type depends on the `statusType` parameter sent with the command,
 * cf. `BatteryStatusType`.
 */
export type GetBatteryStatusResponse = number | BatteryStatusFlags;

/**
 * Command to get the battery status of the device.
 * The parameter statusType defines the type of information to retrieve, cf.
 * `BatteryStatusType`.
 *
 * WARNING: this command should not be sent within a logic of polling as it is
 * going to decrease the overall performance of the communication with the device.
 */
export class GetBatteryStatusCommand
  implements Command<GetBatteryStatusResponse, BatteryStatusType>
{
  private _statusType: BatteryStatusType | undefined = undefined;

  getApdu(statusType: BatteryStatusType): Apdu {
    this._statusType = statusType;
    const getBatteryStatusArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x10,
      p1: 0x00,
      p2: statusType,
    } as const;
    return new ApduBuilder(getBatteryStatusArgs).build();
  }

  parseResponse(apduResponse: ApduResponse): GetBatteryStatusResponse {
    if (this._statusType === undefined) {
      throw new InvalidBatteryStatusTypeError(
        "Call getApdu to initialise battery status type.",
      );
    }

    const parser = new ApduParser(apduResponse);
    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      throw new InvalidStatusWordError(
        `Unexpected status word: ${parser.encodeToHexaString(
          apduResponse.statusCode,
        )}`,
      );
    }

    switch (this._statusType) {
      case BatteryStatusType.BATTERY_PERCENTAGE: {
        const percentage = parser.extract8BitUint();
        if (!percentage) {
          throw new InvalidBatteryDataError("Cannot parse APDU response");
        }
        return percentage > 100 ? -1 : percentage;
      }
      case BatteryStatusType.BATTERY_VOLTAGE: {
        const data = parser.extract16BitUInt();
        if (!data) {
          throw new InvalidBatteryDataError("Cannot parse APDU response");
        }
        return data;
      }
      case BatteryStatusType.BATTERY_TEMPERATURE:
      case BatteryStatusType.BATTERY_CURRENT: {
        const data = parser.extract8BitUint();
        if (!data) {
          throw new InvalidBatteryDataError("Cannot parse APDU response");
        }
        return (data << 24) >> 24;
      }
      case BatteryStatusType.BATTERY_FLAGS: {
        const flags = parser.extract32BitUInt();
        if (!flags) {
          throw new InvalidBatteryFlagsError("Cannot parse APDU response");
        }
        const chargingUSB = !!(flags & FlagMasks.USB_POWERED);
        const chargingQi = !chargingUSB && !!(flags & FlagMasks.CHARGING);
        return {
          charging: chargingQi
            ? ChargingMode.QI
            : chargingUSB
              ? ChargingMode.USB
              : ChargingMode.NONE,
          issueCharging: !!(flags & FlagMasks.ISSUE_CHARGING),
          issueTemperature: !!(flags & FlagMasks.ISSUE_TEMPERATURE),
          issueBattery: !!(flags & FlagMasks.ISSUE_BATTERY),
        };
      }
      default:
        this._exhaustiveMatchingGuard(this._statusType);
    }
  }

  private _exhaustiveMatchingGuard(_: never): never {
    throw new InvalidBatteryStatusTypeError("One or some case(s) not covered");
  }
}
