import { Observable } from "rxjs";

import { Transport } from "@api/transport/model/Transport";
import { InternalDiscoveredDevice } from "@internal/transport/model/InternalDiscoveredDevice";

export class WebBleTransport implements Transport {
  listenToKnownDevices(): Observable<InternalDiscoveredDevice[]> {
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
