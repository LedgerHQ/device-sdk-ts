import {
  type LogParams,
  type SendApduResult,
  type TransportDiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { type Observable } from "rxjs";

import {
  type InternalConnectionResult,
  type InternalDeviceDisconnected,
} from "./types";

/**
 * Interface for the native module wrapper.
 * This interface is used to abstract the native module implementation & its
 * types, basically the implementation of the "bridge".
 * It is useful in case the (future) iOS native module signature is different
 * from the Android one.
 * It allows the RNHidTransport implementation to be platform-agnostic and
 * independent from the native module implementation.
 */
export interface NativeModuleWrapper {
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  subscribeToDiscoveredDevicesEvents(): Observable<
    Array<TransportDiscoveredDevice>
  >;
  subscribeToDeviceDisconnectedEvents(): Observable<InternalDeviceDisconnected>;
  subscribeToTransportLogs(): Observable<LogParams>;
  connectDevice(uid: string): Promise<InternalConnectionResult>;
  disconnectDevice(uid: string): Promise<void>;
  sendApdu(sessionId: string, apdu: Uint8Array): Promise<SendApduResult>;
}
