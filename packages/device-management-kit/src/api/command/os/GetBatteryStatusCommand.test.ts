import { InvalidResponseFormatError } from "@api/command/Errors";
import {
  CommandResultFactory,
  isSuccessCommandResult,
} from "@api/command/model/CommandResult";
import { GlobalCommandErrorHandler } from "@api/command/utils/GlobalCommandError";
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
const PERCENTAGE_OVERFLOW_RESPONSE_HEX = Uint8Array.from([0x65, 0x90, 0x00]);
const VOLTAGE_RESPONSE_HEX = Uint8Array.from([0x0f, 0xff, 0x90, 0x00]);
const TEMPERATURE_RESPONSE_HEX = Uint8Array.from([0x10, 0x90, 0x00]);
const CURRENT_RESPONSE_HEX = Uint8Array.from([0xff, 0x90, 0x00]);
const FLAGS_RESPONSE_HEX = Uint8Array.from([
  0x00, 0x00, 0x00, 0x0f, 0x90, 0x00,
]);
const QI_FLAGS_RESPONSE_HEX = Uint8Array.from([
  0x00, 0x00, 0x00, 0x01, 0x90, 0x00,
]);
const NONE_FLAGS_RESPONSE_HEX = Uint8Array.from([
  0x00, 0x00, 0x00, 0x00, 0x90, 0x00,
]);
const EMPTY_SUCCESS_RESPONSE_HEX = Uint8Array.from([0x90, 0x00]);
const FAILED_RESPONSE_HEX = Uint8Array.from([0x67, 0x00]);

describe("GetBatteryStatus", () => {
  describe("name", () => {
    it("should be 'getBatteryStatus'", () => {
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_PERCENTAGE,
      });
      expect(command.name).toBe("getBatteryStatus");
    });
  });

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
    it("should return -1 when battery percentage is above 100", () => {
      const PERCENTAGE_OVERFLOW_RESPONSE = new ApduResponse({
        statusCode: PERCENTAGE_OVERFLOW_RESPONSE_HEX.slice(-2),
        data: PERCENTAGE_OVERFLOW_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_PERCENTAGE,
      });
      const parsed = command.parseResponse(PERCENTAGE_OVERFLOW_RESPONSE);
      expect(parsed).toStrictEqual(CommandResultFactory({ data: -1 }));
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
    it("should parse the response when querying current", () => {
      const CURRENT_RESPONSE = new ApduResponse({
        statusCode: CURRENT_RESPONSE_HEX.slice(-2),
        data: CURRENT_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_CURRENT,
      });
      const parsed = command.parseResponse(CURRENT_RESPONSE);
      expect(parsed).toStrictEqual(CommandResultFactory({ data: -1 }));
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
    it("should parse the response when querying flags with Qi charging", () => {
      const QI_FLAGS_RESPONSE = new ApduResponse({
        statusCode: QI_FLAGS_RESPONSE_HEX.slice(-2),
        data: QI_FLAGS_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_FLAGS,
      });
      const parsed = command.parseResponse(QI_FLAGS_RESPONSE);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            charging: ChargingMode.QI,
            issueCharging: false,
            issueTemperature: false,
            issueBattery: false,
          },
        }),
      );
    });
    it("should parse the response when querying flags with no charging", () => {
      const NONE_FLAGS_RESPONSE = new ApduResponse({
        statusCode: NONE_FLAGS_RESPONSE_HEX.slice(-2),
        data: NONE_FLAGS_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_FLAGS,
      });
      const parsed = command.parseResponse(NONE_FLAGS_RESPONSE);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            charging: ChargingMode.NONE,
            issueCharging: false,
            issueTemperature: false,
            issueBattery: false,
          },
        }),
      );
    });
    it("should return a handled command error when the status word is not successful", () => {
      const FAILED_RESPONSE = new ApduResponse({
        statusCode: FAILED_RESPONSE_HEX.slice(-2),
        data: FAILED_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_PERCENTAGE,
      });
      const result = command.parseResponse(FAILED_RESPONSE);
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: GlobalCommandErrorHandler.handle(FAILED_RESPONSE),
        }),
      );
    });
    it("should return InvalidResponseFormatError when expected battery data is missing", () => {
      const EMPTY_SUCCESS_RESPONSE = new ApduResponse({
        statusCode: EMPTY_SUCCESS_RESPONSE_HEX.slice(-2),
        data: EMPTY_SUCCESS_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_PERCENTAGE,
      });
      const result = command.parseResponse(EMPTY_SUCCESS_RESPONSE);
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidResponseFormatError(
            "getBatteryStatus: missing battery percentage in response",
          ),
        }),
      );
    });
    it("should return InvalidResponseFormatError when voltage data is missing", () => {
      const EMPTY_SUCCESS_RESPONSE = new ApduResponse({
        statusCode: EMPTY_SUCCESS_RESPONSE_HEX.slice(-2),
        data: EMPTY_SUCCESS_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_VOLTAGE,
      });
      const result = command.parseResponse(EMPTY_SUCCESS_RESPONSE);
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidResponseFormatError(
            "getBatteryStatus: missing battery voltage in response",
          ),
        }),
      );
    });
    it("should return InvalidResponseFormatError when temperature data is missing", () => {
      const EMPTY_SUCCESS_RESPONSE = new ApduResponse({
        statusCode: EMPTY_SUCCESS_RESPONSE_HEX.slice(-2),
        data: EMPTY_SUCCESS_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_TEMPERATURE,
      });
      const result = command.parseResponse(EMPTY_SUCCESS_RESPONSE);
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidResponseFormatError(
            "getBatteryStatus: missing battery temperature in response",
          ),
        }),
      );
    });
    it("should return InvalidResponseFormatError when current data is missing", () => {
      const EMPTY_SUCCESS_RESPONSE = new ApduResponse({
        statusCode: EMPTY_SUCCESS_RESPONSE_HEX.slice(-2),
        data: EMPTY_SUCCESS_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_CURRENT,
      });
      const result = command.parseResponse(EMPTY_SUCCESS_RESPONSE);
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidResponseFormatError(
            "getBatteryStatus: missing battery current in response",
          ),
        }),
      );
    });
    it("should return InvalidResponseFormatError when flags data is missing", () => {
      const EMPTY_SUCCESS_RESPONSE = new ApduResponse({
        statusCode: EMPTY_SUCCESS_RESPONSE_HEX.slice(-2),
        data: EMPTY_SUCCESS_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: BatteryStatusType.BATTERY_FLAGS,
      });
      const result = command.parseResponse(EMPTY_SUCCESS_RESPONSE);
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidResponseFormatError(
            "getBatteryStatus: missing battery flags in response",
          ),
        }),
      );
    });
    it("should return InvalidResponseFormatError when status type is unsupported", () => {
      const PERCENTAGE_RESPONSE = new ApduResponse({
        statusCode: PERCENTAGE_RESPONSE_HEX.slice(-2),
        data: PERCENTAGE_RESPONSE_HEX.slice(0, -2),
      });
      const command = new GetBatteryStatusCommand({
        statusType: 0xff as BatteryStatusType,
      });
      const result = command.parseResponse(PERCENTAGE_RESPONSE);
      expect(isSuccessCommandResult(result)).toBeFalsy();
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidResponseFormatError(
            "getBatteryStatus: unsupported battery status type",
          ),
        }),
      );
    });
  });
});
