import { type Device } from "@ledgerhq/device-mockserver-client";
import { injectable } from "inversify";

import {
  deriveGetAppAndVersion,
  deriveGetBatteryStatus,
  deriveGetOsVersion,
} from "@internal/derived/service/osCommands";

/**
 * Synthesizes the OS-handshake APDU responses (GetOsVersion / GetAppAndVersion)
 * from a device's metadata, so a device connects without any seeded mock.
 */
@injectable()
export class DerivedOsCommandsService {
  /** Derived GetOsVersion response, or `undefined` for an unsupported model. */
  getOsVersion(device: Device): string | undefined {
    return deriveGetOsVersion(device);
  }

  /** Derived GetAppAndVersion response (dashboard / BOLOS). */
  getAppAndVersion(device: Device): string {
    return deriveGetAppAndVersion(device);
  }

  /** Derived GetBatteryStatus response, or `undefined` when unsupported. */
  getBatteryStatus(device: Device, apdu: string): string | undefined {
    return deriveGetBatteryStatus(device, apdu);
  }
}
