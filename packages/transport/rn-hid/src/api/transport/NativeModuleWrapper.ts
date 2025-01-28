import { type TransportDiscoveredDevice } from "@ledgerhq/device-management-kit";
import { from, type Observable } from "rxjs";

import {
  type ConnectionResult,
  type DeviceDisconnected,
  type Log,
  type SendApduResult,
} from "./types";

export interface NativeModuleWrapper {
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  subscribeToDiscoveredDevicesEvents(): Observable<
    Array<TransportDiscoveredDevice>
  >;
  subscribeToDeviceDisconnectedEvents(): Observable<DeviceDisconnected>;
  subscribeToTransportLogs(): Observable<Log>;
  connectDevice(uid: string): Promise<ConnectionResult>;
  disconnectDevice(uid: string): Promise<void>; // TODO: better return type
  sendApdu(sessionId: string, apdu: Uint8Array): Promise<SendApduResult>;
}

export class StubNativeModuleWrapper implements NativeModuleWrapper {
  startScan() {
    return Promise.resolve();
  }

  stopScan() {
    return Promise.resolve();
  }

  subscribeToDiscoveredDevicesEvents(): Observable<
    Array<TransportDiscoveredDevice>
  > {
    return from([]);
  }

  subscribeToTransportLogs(): Observable<Log> {
    return from([]);
  }

  connectDevice(): Promise<ConnectionResult> {
    throw new Error("Method not implemented.");
  }

  disconnectDevice(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  sendApdu(): Promise<SendApduResult> {
    throw new Error("Method not implemented.");
  }

  subscribeToDeviceDisconnectedEvents(): Observable<DeviceDisconnected> {
    return from([]);
  }
}
