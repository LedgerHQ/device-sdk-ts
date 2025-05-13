import { type GetAppAndVersionResponse } from "@api/command/os/GetAppAndVersionCommand";
import { type BatteryStatusFlags } from "@api/command/os/GetBatteryStatusCommand";
import { type GetOsVersionResponse } from "@api/command/os/GetOsVersionCommand";
import { type DeviceModelId } from "@api/device/DeviceModel";
import { type DeviceStatus } from "@api/device/DeviceStatus";
import { type Application } from "@internal/manager-api/model/Application";
import {
  type FinalFirmware,
  type OsuFirmware,
} from "@internal/manager-api/model/Firmware";
import { type LanguagePackage } from "@internal/manager-api/model/Language";

/**
 * The battery status of a device.
 */
export type BatteryStatus = {
  readonly level: number;
  readonly voltage: number;
  readonly temperature: number;
  readonly current: number;
  readonly status: BatteryStatusFlags;
};

/**
 * The firmware version of a device.
 */
export type FirmwareVersion = {
  /**
   * Microcontroller Unit version
   */
  readonly mcu: string;

  /**
   * Bootloader version
   */
  readonly bootloader: string;

  /**
   * Operating System version
   */
  readonly os: string;

  /**
   * Metadata for advanced users, to get detailed informations on
   * the firmware running on the device.
   */
  readonly metadata?: GetOsVersionResponse;
};

/**
 * Context for firmware updates
 */
export type FirmwareUpdateContext = {
  /**
   * Current installed firmware
   */
  readonly currentFirmware: FinalFirmware;

  /**
   * Available firmware update
   */
  readonly availableUpdate?: FirmwareUpdate;
};

/**
 * Available firmware update
 */
export type FirmwareUpdate = {
  /**
   * Version of the OS updater firmware
   */
  readonly osuFirmware: OsuFirmware;

  /**
   * Version of the final firmware
   */
  readonly finalFirmware: FinalFirmware;

  /**
   * Indicates if the MCU needs to be updated
   */
  readonly mcuUpdateRequired: boolean;
};

/**
 * The app store catalog for that device.
 */
export type Catalog = {
  /**
   * Available applications for the device
   */
  readonly applications: Application[];

  /**
   * Available languages packages for the device
   */
  readonly languagePackages: LanguagePackage[];
};

/**
 * Language package installed on the device
 */
export type InstalledLanguagePackage = {
  /**
   * The identifier of the language package
   */
  readonly id: number;

  /**
   * The size of the language package
   */
  readonly size: number;
};

/**
 * Custom image metadata, if one was loaded on the device
 */
export type CustomImage = {
  /**
   * The size of loaded custom image, if one was loaded
   */
  readonly size?: number;
};

/**
 * The current application running on a device. Alias of GetAppAndVersionResponse.
 */
export type RunningApp = GetAppAndVersionResponse;

/**
 * The state types of a device session.
 */
export enum DeviceSessionStateType {
  Connected,
  ReadyWithoutSecureChannel,
  ReadyWithSecureChannel,
}

type DeviceSessionBaseState = {
  readonly sessionStateType: DeviceSessionStateType;

  /**
   * The status of the device.
   */
  readonly deviceStatus: DeviceStatus;

  /**
   * The model of the device.
   */
  readonly deviceModelId: DeviceModelId;

  /**
   * The name of the device.
   */
  readonly deviceName?: string;
};

type DeviceSessionReadyState = {
  /**
   * The battery status of the device.
   * TODO: This should not be optional, but it is not in the current implementation.
   */
  readonly batteryStatus?: BatteryStatus;

  /**
   * The firmware version of the device.
   * TODO: This should not be optional, but it is not in the current implementation.
   */
  readonly firmwareVersion?: FirmwareVersion;

  /**
   * Context of available firmware update
   */
  readonly firmwareUpdateContext?: FirmwareUpdateContext;

  /**
   * The current application running on the device.
   */
  readonly currentApp: RunningApp;

  /**
   * The current applications installed on the device.
   */
  readonly installedApps: Application[];

  /**
   * Available updates from the app store for installed applications.
   */
  readonly appsUpdates?: Application[];

  /**
   * The current language packages installed on the device.
   */
  readonly installedLanguages?: InstalledLanguagePackage[];

  /**
   * Catalog of available applications and languages for the device.
   */
  readonly catalog?: Catalog;

  /**
   * Custom image metadata.
   */
  readonly customImage?: CustomImage;

  /**
   * The device is allowed to establish a secure connection.
   */
  readonly isSecureConnectionAllowed: boolean;
};

/**
 * The state of a connected device session.
 */
export type ConnectedState = DeviceSessionBaseState & {
  /**
   * The type of the device session state.
   */
  readonly sessionStateType: DeviceSessionStateType.Connected;
};

/**
 * The state of a device session when it is ready without a secure channel.
 */
export type ReadyWithoutSecureChannelState = DeviceSessionBaseState &
  DeviceSessionReadyState & {
    /**
     * The type of the device session state.
     */
    readonly sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel;
  };

/**
 * The state of a device session when it is ready with a secure channel.
 */
export type ReadyWithSecureChannelState = DeviceSessionBaseState &
  DeviceSessionReadyState & {
    /**
     * The type of the device session state.
     */
    readonly sessionStateType: DeviceSessionStateType.ReadyWithSecureChannel;
  };

/**
 * The state of a device session.
 */
export type DeviceSessionState =
  | ConnectedState
  | ReadyWithoutSecureChannelState
  | ReadyWithSecureChannelState;
