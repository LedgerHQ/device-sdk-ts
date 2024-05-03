import { DeviceStatus } from "@api/device/DeviceStatus";
import { DeviceSessionId } from "@api/device-session/types";

export type SessionStateConstructorArgs = {
  sessionId: DeviceSessionId;
  deviceStatus: DeviceStatus;
};

export type ConnectedStateConstructorArgs = Pick<
  SessionStateConstructorArgs,
  "sessionId"
>; // & {};

export type ReadyWithoutSecureChannelStateConstructorArgs = Pick<
  ConnectedStateConstructorArgs,
  "sessionId"
> & {
  batteryStatus?: BatteryStatus;
  firmwareVersion?: FirmwareVersion;
  currentApp?: string;
};

export type BatteryStatus = {
  level: number;
};

export type FirmwareVersion = {
  mcu: string; // Microcontroller Unit version
  bootloader: string; // Bootloader version
  os: string; // Operating System version
};

export class DeviceSessionState {
  public readonly sessionId: DeviceSessionId;
  public readonly deviceStatus: DeviceStatus;

  constructor({ sessionId, deviceStatus }: SessionStateConstructorArgs) {
    this.sessionId = sessionId;
    this.deviceStatus = deviceStatus;
  }
}

export class ConnectedState extends DeviceSessionState {
  // private readonly _deviceName: string; // GetDeviceNameResponse
  constructor({ sessionId }: ConnectedStateConstructorArgs) {
    super({ sessionId, deviceStatus: DeviceStatus.CONNECTED });
  }
}

export class ReadyWithoutSecureChannelState extends ConnectedState {
  private readonly _batteryStatus: BatteryStatus | null = null; // GetBatteryStatusResponse
  private readonly _firmwareVersion: FirmwareVersion | null = null; // GetOsVersionResponse
  private readonly _currentApp: string | null = null; // GetAppVersionResponse
  // private readonly _deviceName: string; // GetDeviceNameResponse

  constructor({
    sessionId,
    currentApp,
    batteryStatus,
    firmwareVersion,
  }: ReadyWithoutSecureChannelStateConstructorArgs) {
    super({ sessionId });
    this._currentApp = currentApp ? currentApp : null;
    this._batteryStatus = batteryStatus ? batteryStatus : null;
    this._firmwareVersion = firmwareVersion ? firmwareVersion : null;
  }

  public get batteryStatus() {
    return this._batteryStatus;
  }

  public get firmwareVersion() {
    return this._firmwareVersion;
  }

  public get currentApp() {
    return this._currentApp;
  }
}

export class ReadyWithSecureChannelState extends ReadyWithoutSecureChannelState {}
