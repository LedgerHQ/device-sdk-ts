import { type NativeModule } from "react-native";

export type NativeLedgerDevice = {
  name: "NanoS" | "NanoSPlus" | "NanoX" | "Flex" | "Stax";
  usbProductIdMask: string;
};

export type NativeDiscoveryDevice = {
  uid: string;
  name: string;
  ledgerDevice: NativeLedgerDevice;
};

type NativeLogLevel = "debug" | "info" | "warning" | "error";

export type NativeLog = {
  level: NativeLogLevel;
  tag: string;
  message: string;
  jsonPayload: Record<string, string>;
  timestamp: string;
};

export type NativeInternalConnectionResult =
  | {
      success: true;
      sessionId: string;
      ledgerDevice: NativeLedgerDevice;
      deviceName: string;
    }
  | {
      success: false;
      error: string;
    };

export type NativeSendApduResult =
  | {
      success: true;
      apdu: string;
    }
  | {
      success: false;
      error: string;
    };

export type NativeDeviceConnectionLost = {
  id: string;
};

/**
 * Events
 */

/** DiscoveredDevices */
export const DISCOVERED_DEVICES_EVENT = "DiscoveredDevices";
export type DiscoveredDevicesEventPayload = Array<NativeDiscoveryDevice>;

/** TransportLog */
export const TRANSPORT_LOG_EVENT = "TransportLog";
export type LogEventPayload = NativeLog;

/** DeviceDisconnected */
export const DEVICE_DISCONNECTED_EVENT = "DeviceDisconnected";
export type DeviceDisconnectedEventPayload = NativeDeviceConnectionLost;

/**
 * Signature of the native transport module.
 */
export type NativeTransportModuleType = {
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  connectDevice: (uid: string) => Promise<NativeInternalConnectionResult>;
  disconnectDevice: (sessionId: string) => Promise<void>;
  sendApdu: (sessionId: string, apdu: string) => Promise<NativeSendApduResult>;
} & NativeModule;
