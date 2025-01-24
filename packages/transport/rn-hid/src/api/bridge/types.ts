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

/**
 * Events
 */

export const DISCOVERED_DEVICES_EVENT = "DiscoveredDevices";
export type DiscoveredDevicesEventPayload = Array<NativeDiscoveryDevice>;

type DiscoveredDevicesEvent = {
  type: typeof DISCOVERED_DEVICES_EVENT;
  payload: DiscoveredDevicesEventPayload;
};

/**
 * All events type
 */

export type NativeEvent = DiscoveredDevicesEvent;
