import {
  type DeviceActionState,
  type DeviceLockedError,
  type GetOsVersionResponse,
  type SecureChannelError,
  type UnknownDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type FinalFirmware } from "@api/device-action/OsUpdate/Shared/types";

import { type FlashMcuDAErrors } from "./FlashMcuDeviceActionErrors";

/*
 * A planned MCU flash knows the firmware it is making room for, while a
 * bootloader recovery has to derive it from whatever the broken device reports.
 */
export type FlashMcuDAInput =
  | {
      mode: "osUpdate";
      finalFirmware: FinalFirmware;
    }
  | {
      mode: "bootloaderRecovery";
    };

export type SecureChannelFlashMcuDAErrors =
  | SecureChannelError
  | DeviceLockedError
  | UnknownDAError;

export type FlashMcuDAError = FlashMcuDAErrors | SecureChannelFlashMcuDAErrors;

export type FlashMcuDARequiredInteraction = UserInteractionRequired.None;

export type FlashMcuDAIntermediateValue = {
  requiredUserInteraction: FlashMcuDARequiredInteraction;
  step: FlashMcuSteps;
  progress?: number;
};

export type FlashTarget = "mcu" | "bootloader";

export type ResolvedFlash = {
  target: FlashTarget;
  version: string;
};

/*
 * "mcu" ends the flash loop. "bootloader" is followed by another flash.
 */
export type FlashMcuDAOutput = {
  target: FlashTarget;
};

export type FlashMcuDAInternalState = {
  error: FlashMcuDAError | null;
  deviceInfo: GetOsVersionResponse | null;
  resolvedFlash: ResolvedFlash | null;
  bootloaderPollAttempts: number;
};

export type FlashMcuDAState = DeviceActionState<
  FlashMcuDAOutput,
  FlashMcuDAError,
  FlashMcuDAIntermediateValue
>;

export enum FlashMcuSteps {
  Idle = "idle",
  GetDeviceInfo = "getDeviceInfo",
  ResolveMcuVersion = "resolveMcuVersion",
  FlashMcuOrBootloader = "flashMcuOrBootloader",
}
