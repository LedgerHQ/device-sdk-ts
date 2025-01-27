import { type TransportDiscoveredDevice } from "@ledgerhq/device-management-kit";
import type { Observable } from "rxjs";

import { type Log } from "./types";

export interface NativeModuleWrapper {
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  subscribeToDiscoveredDevicesEvents(): Observable<
    Array<TransportDiscoveredDevice>
  >;
  subscribeToTransportLogs(): Observable<Log>;
}
