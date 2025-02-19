import { type Transport } from "@api/transport/model/Transport";

export class TransportMock implements Transport {
  constructor() {}
  getIdentifier = vi.fn();
  isSupported = vi.fn();
  startDiscovering = vi.fn();
  stopDiscovering = vi.fn();
  listenToAvailableDevices = vi.fn();
  connect = vi.fn();
  disconnect = vi.fn();
}
