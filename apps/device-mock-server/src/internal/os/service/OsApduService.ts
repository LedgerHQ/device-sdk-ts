import { type Device } from "@ledgerhq/device-mockserver-client";
import { injectable } from "inversify";

import { deriveOsApduResponse } from "@internal/os/service/osApdus";

/**
 * Synthesizes the OS-handshake APDU responses (GetOsVersion / GetAppAndVersion /
 * GetBatteryStatus) from a device's metadata, so a device connects without any
 * seeded mock.
 */
@injectable()
export class OsApduService {
  /** Derived OS-handshake response for an APDU, or `undefined`. */
  resolve(device: Device, apdu: string): string | undefined {
    return deriveOsApduResponse(device, apdu);
  }
}
