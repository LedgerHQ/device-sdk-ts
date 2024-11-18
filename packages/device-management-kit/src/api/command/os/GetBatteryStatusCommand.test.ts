import {
  CommandResultFactory,
  isSuccessCommandResult,
} from "@api/command/model/CommandResult";
import { ApduResponse } from "@api/device-session/ApduResponse";

import {
  BatteryStatusType,
  ChargingMode,
  GetBatteryStatusCommand,
} from "./GetBatteryStatusCommand";

const GET_BATTERY_STATUS_APDU_PERCENTAGE = Uint8Array.from([
  0xe0, 0x10, 0x00, 0x00, 0x00,
]);
const GET_BATTERY_STATUS_APDU_VOLTAGE = Uint8Array.from([
  0xe0, 0x10, 0x00, 0x01, 0x00,
]);
const GET_BATTERY_STATUS_APDU_TEMPERATURE = Uint8Array.from([
  0xe0, 0x10, 0x00, 0x02, 0x00,
]);
const GET_BATTERY_STATUS_APDU_CURRENT = Uint8Array.from([
  0xe0, 0x10, 0x00, 0x03, 0x00,
]);
const GET_BATTERY_STATUS_APDU_FLAGS = Uint8Array.from([
  0xe0, 0x10, 0x00, 0x04, 0x00,
]);

const PERCENTAGE_RESPONSE_HEX = Uint8Array.from([0x37, 0x90, 0x00]);
const VOLTAGE_RESPONSE_HEX = Uint8Array.from([0x0f, 0xff, 0x90, 0x00]);
const TEMPERATURE_RESPONSE_HEX = Uint8Array.from([0x10, 0x90, 0x00]);
const FLAGS_RESPONSE_HEX = Uint8Array.from([
  0x00, 0x00, 0x00, 0x0f, 0x90, 0x00,
]);
const FAILED_RESPONSE_HEX = Uint8Array.from([0x67, 0x00]);

describe("GetBatteryStatus", () => {
  describe("getApdu", () => {
    it("should return the GetBatteryStatus APDU", () => {
      expect(
        new GetBatteryStatusCommand({
          statusType: BatteryStatusType.BATTERY_PERCENTAGE,
        })
          .getApdu()
          .getRawApdu(),
      ).toStrictEqual(GET_BATTERY_STATUS_APDU_PERCENTAGE);
      expect(
        new GetBatteryStatusCommand({
          statusType: BatteryStatusType.BATTERY_VOLTAGE,
        })
          .getApdu()
          .getRawApdu(),
      ).toStrictEqual(GET_BATTERY_STATUS_APDU_VOLTAGE);
      expect(
        new GetBatteryStatusCommand({
          statusType: BatteryStatusType.BATTERY_TEMPERATURE,
        })
          .getApdu()
          .getRawApdu(),
      ).toStrictEqual(GET_BATTERY_STATUS_APDU_TEMPERATURE);
      expect(
        new GetBatteryStatusCommand({
          statusType: BatteryStatusType.BATTERY_CURRENT,
        })
          .getApdu()
          .getRawApdu(),
      ).toStrictEqual(GET_BATTERY_STATUS_APDU_CURRENT);
      expect(
        new GetBatteryStatusCommand({
          statusType: BatteryStatusType.BATTERY_FLAGS,
        })
          .getApdu()
          .getRawApdu(),
      ).toStrictEqual(GET_BATTERY_STATUS_APDU_FLAGS);
    });
  });
  describe("parseResponse", () => {
    it("should parse the response when querying percentage", () => {
      const PERCENTAGE_RESPONSE = new ApduResponse({
        statusCode: PERCENTAGE_RESPONSE_HEX.slice(-2),
        data: PERCENTAGE_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_PERCENTAGE,
      });
      const parsed = command.parseResponse(PERCENTAGE_RESPONSE);
      expect(parsed).toStrictEqual(CommandResultFactory({ data: 55 }));
    });
    it("should parse the response when querying voltage", () => {
      const VOLTAGE_RESPONSE = new ApduResponse({
        statusCode: VOLTAGE_RESPONSE_HEX.slice(-2),
        data: VOLTAGE_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_VOLTAGE,
      });
      const parsed = command.parseResponse(VOLTAGE_RESPONSE);
      expect(parsed).toStrictEqual(CommandResultFactory({ data: 4095 }));
    });
    it("should parse the response when querying temperature", () => {
      const TEMPERATURE_RESPONSE = new ApduResponse({
        statusCode: TEMPERATURE_RESPONSE_HEX.slice(-2),
        data: TEMPERATURE_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_TEMPERATURE,
      });
      const parsed = command.parseResponse(TEMPERATURE_RESPONSE);
      expect(parsed).toStrictEqual(CommandResultFactory({ data: 16 }));
    });
    it("should parse the response when querying flags", () => {
      const FLAGS_RESPONSE = new ApduResponse({
        statusCode: FLAGS_RESPONSE_HEX.slice(-2),
        data: FLAGS_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_FLAGS,
      });
      const parsed = command.parseResponse(FLAGS_RESPONSE);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            charging: ChargingMode.USB,
            issueCharging: false,
            issueTemperature: false,
            issueBattery: false,
          },
        }),
      );
    });
    it("should return an error if the response returned unsupported format", () => {
      const FAILED_RESPONSE = new ApduResponse({
        statusCode: FAILED_RESPONSE_HEX.slice(-2),
        data: FAILED_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_PERCENTAGE,
      });
      const result = command.parseResponse(FAILED_RESPONSE);
      expect(isSuccessCommandResult(result)).toBeFalsy();
    });
  });
});
