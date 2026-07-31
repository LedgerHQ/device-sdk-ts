import { type Device } from "@ledgerhq/device-mockserver-client";
import { inject, injectable, optional } from "inversify";

import {
  deriveOsApduResponse,
  GET_OS_VERSION_PREFIX,
  resolveTargetId,
} from "@internal/os/service/osApdus";
import { secureChannelTypes } from "@internal/secure-channel/di/secureChannelTypes";
import { type FirmwareUpdateResolver } from "@internal/secure-channel/service/FirmwareUpdateResolver";

/**
 * Synthesizes the OS-handshake APDU responses (GetOsVersion / GetAppAndVersion /
 * GetBatteryStatus) from a device's metadata, so a device connects without any
 * seeded mock.
 */
@injectable()
export class OsApduService {
  constructor(
    @optional()
    @inject(secureChannelTypes.FirmwareUpdateResolver)
    private readonly firmwareResolver?: FirmwareUpdateResolver,
  ) {}

  /** Derived OS-handshake response for an APDU, or `undefined`. */
  async resolve(device: Device, apdu: string): Promise<string | undefined> {
    if (apdu.startsWith(GET_OS_VERSION_PREFIX)) {
      const mcuVersion = await this.resolveMcuVersion(device);
      return deriveOsApduResponse(device, apdu, mcuVersion);
    }
    return deriveOsApduResponse(device, apdu);
  }

  /**
   * Resolve the device's current MCU version from the Manager API so GetOsVersion
   * advertises an MCU that keeps `shouldFlashMCU` false. Returns `undefined` when
   * no resolver is wired or the lookup yields nothing, so GetOsVersion is not
   * synthesized and the APDU falls through.
   */
  private async resolveMcuVersion(device: Device): Promise<string | undefined> {
    const targetId = resolveTargetId(device);
    const currentVersion = device.firmware_version;
    if (!this.firmwareResolver || targetId === undefined || !currentVersion) {
      return undefined;
    }
    const resolved = await this.firmwareResolver.resolveCurrentMcuVersion({
      targetId,
      currentVersion,
    });
    return resolved.extract();
  }
}
