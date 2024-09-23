import { BatteryStatusFlags } from "@api/command/os/GetBatteryStatusCommand";
import { DeviceStatus } from "@api/device/DeviceStatus";

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
};

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
   * The current application running on the device.
   */
  readonly currentApp: string;

  /**
   * The current applications installed on the device.
   */
  // readonly installedApps: Application[];
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
