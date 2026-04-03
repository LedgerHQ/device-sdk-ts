import { type ApduResponse } from "@api/device-session/ApduResponse";

const STATUS_CODE_LENGTH = 2;
const SW1_SUCCESS = 0x90;
const SW1_LOCKED_DEVICE = 0x55;
const SW1_COMMAND_NOT_ALLOWED = 0x69;
const SW1_APP_NOT_COMPATIBLE = 0x53;
const SW1_WRONG_PARAMETERS = 0x6a;
const SW1_MEMORY_ERROR = 0x51;
const CLA_OPEN_APP = 0xe0;
const INS_OPEN_APP = 0xd8;
const CLA_CLOSE_APP = 0xb0;
const INS_CLOSE_APP = 0xa7;
const SW2_DEVICE_LOCKED = 0x15;
const SW2_SECURITY_NOT_SATISFIED = 0x82;
const SW2_NOT_COMPATIBLE = 0x03;
const SW2_CONDITIONS_NOT_SATISFIED = 0x85;
const SW2_INCORRECT_DATA = 0x80;
const SW2_FUNCTION_NOT_SUPPORTED = 0x81;
const SW2_ALREADY_INSTALLED_8E = 0x8e;
const SW2_ALREADY_INSTALLED_8F = 0x8f;
const SW2_NOT_ENOUGH_MEMORY = 0x84;
const SW2_MEMORY_PROBLEM = 0x02;
const APDU_HEADER_LENGTH = 4;

export class CommandUtils {
  static isValidStatusCode(statusCode: Uint8Array) {
    return statusCode.length === STATUS_CODE_LENGTH;
  }

  static isSuccessResponse({ statusCode }: ApduResponse) {
    if (!CommandUtils.isValidStatusCode(statusCode)) {
      return false;
    }

    return statusCode[0] === SW1_SUCCESS && statusCode[1] === 0x00;
  }

  static isLockedDeviceResponse({ statusCode }: ApduResponse) {
    if (!CommandUtils.isValidStatusCode(statusCode)) {
      return false;
    }

    return (
      (statusCode[0] === SW1_LOCKED_DEVICE &&
        statusCode[1] === SW2_DEVICE_LOCKED) ||
      (statusCode[0] === SW1_COMMAND_NOT_ALLOWED &&
        statusCode[1] === SW2_SECURITY_NOT_SATISFIED) ||
      (statusCode[0] === SW1_APP_NOT_COMPATIBLE &&
        statusCode[1] === SW2_NOT_COMPATIBLE)
    );
  }

  static isRefusedByUser({ statusCode }: ApduResponse) {
    if (!CommandUtils.isValidStatusCode(statusCode)) {
      return false;
    }

    return (
      (statusCode[0] === SW1_LOCKED_DEVICE && statusCode[1] === 0x01) ||
      (statusCode[0] === SW1_COMMAND_NOT_ALLOWED &&
        statusCode[1] === SW2_CONDITIONS_NOT_SATISFIED)
    );
  }

  static isAppAlreadyInstalled({ statusCode }: ApduResponse) {
    if (!CommandUtils.isValidStatusCode(statusCode)) {
      return false;
    }

    return (
      (statusCode[0] === SW1_WRONG_PARAMETERS &&
        statusCode[1] === SW2_INCORRECT_DATA) ||
      (statusCode[0] === SW1_WRONG_PARAMETERS &&
        statusCode[1] === SW2_FUNCTION_NOT_SUPPORTED) ||
      (statusCode[0] === SW1_WRONG_PARAMETERS &&
        statusCode[1] === SW2_ALREADY_INSTALLED_8E) ||
      (statusCode[0] === SW1_WRONG_PARAMETERS &&
        statusCode[1] === SW2_ALREADY_INSTALLED_8F)
    );
  }

  static isOutOfMemory({ statusCode }: ApduResponse) {
    if (!CommandUtils.isValidStatusCode(statusCode)) {
      return false;
    }

    return (
      (statusCode[0] === SW1_WRONG_PARAMETERS &&
        statusCode[1] === SW2_NOT_ENOUGH_MEMORY) ||
      (statusCode[0] === SW1_WRONG_PARAMETERS &&
        statusCode[1] === SW2_CONDITIONS_NOT_SATISFIED) ||
      (statusCode[0] === SW1_MEMORY_ERROR &&
        statusCode[1] === SW2_MEMORY_PROBLEM) ||
      (statusCode[0] === SW1_MEMORY_ERROR &&
        statusCode[1] === SW2_NOT_COMPATIBLE)
    );
  }

  static isApduThatTriggersDisconnection(apdu: Uint8Array) {
    /**
     * Map of known APDUs that trigger a disconnection.
     */
    const apduMap = new Map();
    apduMap.set(
      "openApp",
      new Uint8Array([CLA_OPEN_APP, INS_OPEN_APP, 0x00, 0x00]),
    );
    apduMap.set(
      "closeApp",
      new Uint8Array([CLA_CLOSE_APP, INS_CLOSE_APP, 0x00, 0x00]),
    );
    // TODO: add more APDUs that trigger a disconnection (e.g firmware flashing ?)

    // check if apdu first 4 UintArray is included in apduMap
    return Array.from(apduMap.values()).some((value: Uint8Array) => {
      for (let i = 0; i < APDU_HEADER_LENGTH; i++) {
        if (value[i] !== apdu[i]) {
          return false;
        }
      }
      return true;
    });
  }
}
