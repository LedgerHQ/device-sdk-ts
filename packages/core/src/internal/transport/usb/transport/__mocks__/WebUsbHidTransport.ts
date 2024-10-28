import { type Transport } from "@api/transport/model/Transport";

export class WebWebHidTransport implements Transport {
  isSupported = jest.fn();
  getIdentifier = jest.fn();
  connect = jest.fn();
  startDiscovering = jest.fn();
  stopDiscovering = jest.fn();

  disconnect = jest.fn();
  listenToKnownDevices = jest.fn();
}

export function WebHidTransportMockBuilder(
  props: Partial<Transport> = {},
): Transport {
  return {
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
