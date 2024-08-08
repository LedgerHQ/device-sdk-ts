import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import {
  InvalidBatteryDataError,
  InvalidBatteryStatusTypeError,
} from "@api/command/Errors";
import {
  CommandResult,
  CommandResultFactory,
} from "@api/command/model/CommandResult";
import { GlobalCommandErrorStatusCode } from "@api/command/utils/GlobalCommandError";
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

export type BatteryStatusFlags = {
  readonly charging: ChargingMode;
  readonly issueCharging: boolean;
  readonly issueTemperature: boolean;
  readonly issueBattery: boolean;
};

/**
 * The response type depends on the `statusType` parameter sent with the command,
 * cf. `BatteryStatusType`.
 */
export type GetBatteryStatusResponse = number | BatteryStatusFlags;

export type GetBatteryStatusArgs = {
  readonly statusType: BatteryStatusType;
};

/**
 * Command to get the battery status of the device.
 * The parameter statusType defines the type of information to retrieve, cf.
 * `BatteryStatusType`.
 *
 * WARNING: this command should not be sent within a logic of polling as it is
 * going to decrease the overall performance of the communication with the device.
 */
export class GetBatteryStatusCommand
  implements
    Command<
      GetBatteryStatusResponse,
      GlobalCommandErrorStatusCode,
      GetBatteryStatusArgs
    >
{
  readonly args: GetBatteryStatusArgs;

  constructor(args: GetBatteryStatusArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const getBatteryStatusArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x10,
      p1: 0x00,
      p2: this.args.statusType,
    };
    return new ApduBuilder(getBatteryStatusArgs).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetBatteryStatusResponse, GlobalCommandErrorStatusCode> {
    const parser = new ApduParser(apduResponse);

    switch (this.args.statusType) {
      case BatteryStatusType.BATTERY_PERCENTAGE: {
        const percentage = parser.extract8BitUInt();
        if (percentage === undefined) {
          return CommandResultFactory({
            error: new InvalidBatteryDataError("Cannot parse APDU response"),
          });
        }
        return CommandResultFactory({
          data: percentage > 100 ? -1 : percentage,
        });
      }
      case BatteryStatusType.BATTERY_VOLTAGE: {
        const data = parser.extract16BitUInt();
        if (data === undefined) {
          return CommandResultFactory({
            error: new InvalidBatteryDataError("Cannot parse APDU response"),
          });
        }
        return CommandResultFactory({
          data,
        });
      }
      case BatteryStatusType.BATTERY_TEMPERATURE:
      case BatteryStatusType.BATTERY_CURRENT: {
        const data = parser.extract8BitUInt();
        if (data === undefined) {
          return CommandResultFactory({
            error: new InvalidBatteryDataError("Cannot parse APDU response"),
          });
        }
        return CommandResultFactory({
          data: (data << 24) >> 24,
        });
      }
      case BatteryStatusType.BATTERY_FLAGS: {
        const flags = parser.extract32BitUInt();
        if (flags === undefined) {
          return CommandResultFactory({
            error: new InvalidBatteryDataError("Cannot parse APDU response"),
          });
        }
        const chargingUSB = !!(flags & FlagMasks.USB_POWERED);
        const chargingQi = !chargingUSB && !!(flags & FlagMasks.CHARGING);
        return CommandResultFactory({
          data: {
            charging: chargingQi
              ? ChargingMode.QI
              : chargingUSB
                ? ChargingMode.USB
                : ChargingMode.NONE,
            issueCharging: !!(flags & FlagMasks.ISSUE_CHARGING),
            issueTemperature: !!(flags & FlagMasks.ISSUE_TEMPERATURE),
            issueBattery: !!(flags & FlagMasks.ISSUE_BATTERY),
          },
        });
      }
      default:
        return CommandResultFactory({
          error: new InvalidBatteryStatusTypeError(
            "One or some case(s) not covered",
          ),
        });
    }
  }
}
