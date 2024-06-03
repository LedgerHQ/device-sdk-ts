import { Transport } from "@api/transport/model/Transport";

export class WebUsbHidTransport implements Transport {
  isSupported = jest.fn();
  getIdentifier = jest.fn();
  connect = jest.fn();
  startDiscovering = jest.fn();
  stopDiscovering = jest.fn();

  disconnect = jest.fn();
}

export function usbHidTransportMockBuilder(
  props: Partial<Transport> = {},
): Transport {
  return {
    isSupported: jest.fn(),
    getIdentifier: jest.fn(),
    startDiscovering: jest.fn(),
    stopDiscovering: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    ...props,
  };
}
