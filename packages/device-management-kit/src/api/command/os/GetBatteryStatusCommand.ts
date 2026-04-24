import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, type ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { type Command } from "@api/command/Command";
import { InvalidResponseFormatError } from "@api/command/Errors";
import {
  type CommandResult,
  CommandResultFactory,
} from "@api/command/model/CommandResult";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { GlobalCommandErrorHandler } from "@api/command/utils/GlobalCommandError";
import { type ApduResponse } from "@api/device-session/ApduResponse";

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
  implements Command<GetBatteryStatusResponse, GetBatteryStatusArgs>
{
  readonly name = "getBatteryStatus";
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
  ): CommandResult<GetBatteryStatusResponse> {
    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }
    const parser = new ApduParser(apduResponse);
    const invalidResponseFormat = (message: string) =>
      CommandResultFactory<GetBatteryStatusResponse>({
        error: new InvalidResponseFormatError(message),
      });

    switch (this.args.statusType) {
      case BatteryStatusType.BATTERY_PERCENTAGE: {
        const percentage = parser.extract8BitUInt();
        if (percentage === undefined) {
          return invalidResponseFormat(
            "getBatteryStatus: missing battery percentage in response",
          );
        }
        return CommandResultFactory({
          data: percentage > 100 ? -1 : percentage,
        });
      }
      case BatteryStatusType.BATTERY_VOLTAGE: {
        const data = parser.extract16BitUInt();
        if (data === undefined) {
          return invalidResponseFormat(
            "getBatteryStatus: missing battery voltage in response",
          );
        }
        return CommandResultFactory({
          data,
        });
      }
      case BatteryStatusType.BATTERY_TEMPERATURE:
      case BatteryStatusType.BATTERY_CURRENT: {
        const data = parser.extract8BitUInt();
        if (data === undefined) {
          return invalidResponseFormat(
            this.args.statusType === BatteryStatusType.BATTERY_TEMPERATURE
              ? "getBatteryStatus: missing battery temperature in response"
              : "getBatteryStatus: missing battery current in response",
          );
        }
        return CommandResultFactory({
          data: (data << 24) >> 24,
        });
      }
      case BatteryStatusType.BATTERY_FLAGS: {
        const flags = parser.extract32BitUInt();
        if (flags === undefined) {
          return invalidResponseFormat(
            "getBatteryStatus: missing battery flags in response",
          );
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
        return invalidResponseFormat(
          "getBatteryStatus: unsupported battery status type",
        );
    }
  }
}
