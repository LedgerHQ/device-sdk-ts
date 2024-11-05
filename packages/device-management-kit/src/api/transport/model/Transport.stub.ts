import { type Transport } from "./Transport";

export class TransportStub implements Transport {
  constructor() {}
  getIdentifier = jest.fn();
  isSupported = jest.fn();
  startDiscovering = jest.fn();
  stopDiscovering = jest.fn();
  listenToKnownDevices = jest.fn();
  connect = jest.fn();
  disconnect = jest.fn();
}
