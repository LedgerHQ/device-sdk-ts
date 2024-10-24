import { type Observable } from "rxjs";

import { type Transport } from "@api/transport/model/Transport";
import { type TransportDiscoveredDevice } from "@api/transport/model/TransportDiscoveredDevice";

export class WebBleTransport implements Transport {
  listenToKnownDevices(): Observable<TransportDiscoveredDevice[]> {
    throw new Error("Method not implemented.");
  }
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
    listenToKnownDevices: jest.fn(),
    ...props,
  };
}
