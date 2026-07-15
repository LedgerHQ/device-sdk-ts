import { type Device } from "@ledgerhq/device-mockserver-client";
import { inject, injectable, optional } from "inversify";

import {
  deriveGetOsVersion,
  deriveOsApduResponse,
  GET_OS_VERSION_PREFIX,
  resolveTargetId,
} from "@internal/os/service/osApdus";
import { secureChannelTypes } from "@internal/secure-channel/di/secureChannelTypes";
import { type FirmwareUpdateResolver } from "@internal/secure-channel/service/FirmwareUpdateResolver";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";
import { type SessionRecord } from "@internal/session/model/SessionModels";

/**
 * toggleOnboardingEarlyCheck (cla=0xe0, ins=0x03, p1=0x00); p2 selects
 * enter (0x00) or exit (0x01) of the early-security-check step. Ledger Live
 * sends this during onboarding (see live-common's `toggleOnboardingEarlyCheck`).
 */
const TOGGLE_EARLY_CHECK_PREFIX = "e00300";
const TOGGLE_EARLY_CHECK_ENTER_P2 = "00";

const STATUS_OK = "9000";

/**
 * Synthesizes the OS-handshake APDU responses (GetOsVersion / GetAppAndVersion /
 * GetBatteryStatus) from a device's metadata, so a device connects without any
 * seeded mock. Also drives the onboarding simulation for devices created with
 * `onboarded: false`.
 */
@injectable()
export class OsApduService {
  constructor(
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
    @optional()
    @inject(secureChannelTypes.FirmwareUpdateResolver)
    private readonly firmwareResolver?: FirmwareUpdateResolver,
  ) {}

  /** Derived OS-handshake response for an APDU, or `undefined`. */
  async resolve(
    record: SessionRecord,
    device: Device,
    apdu: string,
  ): Promise<string | undefined> {
    const onboarding = this.repository.onboardingActive(record, device.id);

    if (apdu.startsWith(GET_OS_VERSION_PREFIX)) {
      const mcuVersion = await this.resolveMcuVersion(device);
      if (onboarding && mcuVersion) {
        const seFlags = this.repository
          .currentOnboardingSeFlags(record, device.id)
          .extract();
        const response = deriveGetOsVersion(device, mcuVersion, seFlags);
        // Report the current step, then advance the walk for the next poll.
        this.repository.advanceOnboarding(record, device.id);
        return response;
      }
      return deriveOsApduResponse(device, apdu, mcuVersion);
    }

    // toggleOnboardingEarlyCheck moves the device in/out of the early-security
    // -check step; only meaningful while onboarding. Always acknowledges.
    if (onboarding && apdu.startsWith(TOGGLE_EARLY_CHECK_PREFIX)) {
      const enter = apdu.slice(6, 8) === TOGGLE_EARLY_CHECK_ENTER_P2;
      this.repository.toggleOnboardingEarlyCheck(record, device.id, enter);
      return STATUS_OK;
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
