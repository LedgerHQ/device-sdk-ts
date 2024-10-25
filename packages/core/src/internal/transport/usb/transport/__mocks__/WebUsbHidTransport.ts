import { Transport } from "@api/transport/model/Transport";

export class WebUsbHidTransport implements Transport {
  setLogger = jest.fn();
  setDeviceModelDataSource = jest.fn();
  setDeviceConnectionFactory = jest.fn();
  setupDependencies = jest.fn();
  isSupported = jest.fn();
  getIdentifier = jest.fn();
  connect = jest.fn();
  startDiscovering = jest.fn();
  stopDiscovering = jest.fn();
  disconnect = jest.fn();
  listenToKnownDevices = jest.fn();
}

export function usbHidTransportMockBuilder(
  props: Partial<Transport> = {},
): Transport {
  return {
    setLogger: jest.fn(),
    setDeviceModelDataSource: jest.fn(),
    setDeviceConnectionFactory: jest.fn(),
    isSupported: jest.fn(),
    getIdentifier: jest.fn(),
    startDiscovering: jest.fn(),
    stopDiscovering: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    listenToKnownDevices: jest.fn(),
    ...props,
  };
}
