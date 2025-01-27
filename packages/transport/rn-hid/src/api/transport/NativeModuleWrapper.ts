import { type TransportDiscoveredDevice } from "@ledgerhq/device-management-kit";
import { from, type Observable } from "rxjs";

import { type Log } from "./types";

export interface NativeModuleWrapper {
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  subscribeToDiscoveredDevicesEvents(): Observable<
    Array<TransportDiscoveredDevice>
  >;
  subscribeToTransportLogs(): Observable<Log>;
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
}
