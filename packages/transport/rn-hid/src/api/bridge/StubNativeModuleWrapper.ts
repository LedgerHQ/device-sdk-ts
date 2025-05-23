import type {
  LogParams,
  SendApduResult,
  TransportDiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { from, type Observable } from "rxjs";

import { type NativeModuleWrapper } from "@api/transport/NativeModuleWrapper";
import type {
  InternalConnectionResult,
  InternalDeviceDisconnected,
} from "@api/transport/types";

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

  subscribeToTransportLogs(): Observable<LogParams> {
    return from([]);
  }

  connectDevice(): Promise<InternalConnectionResult> {
    throw new Error("Method not implemented.");
  }

  disconnectDevice(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  sendApdu(): Promise<SendApduResult> {
    throw new Error("Method not implemented.");
  }

  subscribeToDeviceDisconnectedEvents(): Observable<InternalDeviceDisconnected> {
    return from([]);
  }

  subscribeToExchangeBulkApdusEvents() // requestId: number,
  : Observable<{ requestId: number; index: number }> {
    return from([]);
  }

  exchangeBulkApdus(): Promise<SendApduResult> {
    throw new Error("Method not implemented.");
  }
}
