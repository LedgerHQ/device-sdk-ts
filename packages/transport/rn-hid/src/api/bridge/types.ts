import { type NativeModule } from "react-native";

export type NativeLedgerDevice = {
  name: "NanoS" | "NanoSPlus" | "NanoX" | "Flex" | "Stax";
  usbProductIdMask: string;
};

export type NativeConnectivityType = "usb";

export type NativeDiscoveryDevice = {
  uid: string;
  name: string;
  ledgerDevice: NativeLedgerDevice;
  connectivityType: NativeConnectivityType;
  timestamp: string;
};

type NativeLogLevel = "debug" | "info" | "warning" | "error";

export type NativeLog = {
  level: NativeLogLevel;
  tag: string;
  message: string;
  jsonPayload: Record<string, string>;
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

/**
 * Events
 */

export const DISCOVERED_DEVICES_EVENT = "DiscoveredDevices";
export type DiscoveredDevicesEventPayload = Array<NativeDiscoveryDevice>;

type DiscoveredDevicesEvent = {
  type: typeof DISCOVERED_DEVICES_EVENT;
  payload: DiscoveredDevicesEventPayload;
};

export const TRANSPORT_LOG_EVENT = "TransportLog";
export type LogEventPayload = NativeLog;

type TransportLogEvent = {
  type: typeof TRANSPORT_LOG_EVENT;
  payload: LogEventPayload;
};

/**
 * All events type
 */

export type NativeEvent = DiscoveredDevicesEvent | TransportLogEvent;

/**
 *
 */

export type NativeTransportModuleType = {
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  connectDevice: (uid: string) => Promise<NativeInternalConnectionResult>;
  disconnectDevice: (sessionId: string) => Promise<void>;
  sendApdu: (sessionId: string, apdu: string) => Promise<NativeSendApduResult>;
} & NativeModule;
