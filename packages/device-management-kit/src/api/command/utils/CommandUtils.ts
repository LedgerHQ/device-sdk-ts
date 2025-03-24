import { type ApduResponse } from "@api/device-session/ApduResponse";

export class CommandUtils {
  static isValidStatusCode(statusCode: Uint8Array) {
    return statusCode.length === 2;
  }

  static isSuccessResponse({ statusCode }: ApduResponse) {
    if (!CommandUtils.isValidStatusCode(statusCode)) {
      return false;
    }

    return statusCode[0] === 0x90 && statusCode[1] === 0x00;
  }

  static isLockedDeviceResponse({ statusCode }: ApduResponse) {
    if (!CommandUtils.isValidStatusCode(statusCode)) {
      return false;
    }

    return statusCode[0] === 0x55 && statusCode[1] === 0x15;
  }

  static isApduThatTriggersDisconnection(apdu: Uint8Array) {
    /**
     * Map of known APDUs that trigger a disconnection.
     */
    const apduMap = new Map();
    apduMap.set("openApp", new Uint8Array([0xe0, 0xd8, 0x00, 0x00]));
    apduMap.set("closeApp", new Uint8Array([0xb0, 0xa7, 0x00, 0x00]));
    // TODO: add more APDUs that trigger a disconnection (e.g firmware flashing ?)

    // check if apdu first 4 UintArray is included in apduMap
    return Array.from(apduMap.values()).some((value: Uint8Array) => {
      for (let i = 0; i < 4; i++) {
        if (value[i] !== apdu[i]) {
          return false;
        }
      }
      return true;
    });
  }
}
