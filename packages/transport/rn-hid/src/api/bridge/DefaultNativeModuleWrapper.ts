import { NativeEventEmitter } from "react-native";
import {
  type DeviceModelDataSource,
  type LogParams,
  type SendApduResult,
  type TransportDiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { Observable } from "rxjs";

import { uint8ArrayToBase64 } from "@api/helpers/base64Utils";
import { type NativeModuleWrapper } from "@api/transport/NativeModuleWrapper";
import {
  type InternalConnectionResult,
  type InternalDeviceDisconnected,
} from "@api/transport/types";

import {
  mapNativeConnectionResultToConnectionResult,
  mapNativeDeviceConnectionLostToDeviceDisconnected,
  mapNativeDiscoveryDeviceToTransportDiscoveredDevice,
  mapNativeSendApduResultToSendApduResult,
  mapNativeTransportLogToLog,
} from "./mapper";
import {
  DEVICE_DISCONNECTED_EVENT,
  type DeviceDisconnectedEventPayload,
  DISCOVERED_DEVICES_EVENT,
  type DiscoveredDevicesEventPayload,
  type NativeLog,
  TRANSPORT_LOG_EVENT,
} from "./types";
import { type NativeTransportModuleType } from "./types";

export class DefaultNativeModuleWrapper implements NativeModuleWrapper {
  private readonly _nativeModule: NativeTransportModuleType;
  private readonly _deviceModelDataSource: DeviceModelDataSource;

  constructor(args: {
    nativeModule: NativeTransportModuleType;
    deviceModelDataSource: DeviceModelDataSource;
  }) {
    this._nativeModule = args.nativeModule;
    this._deviceModelDataSource = args.deviceModelDataSource;
  }

  startScan() {
    return this._nativeModule.startScan();
  }

  stopScan() {
    return this._nativeModule.stopScan();
  }

  subscribeToDiscoveredDevicesEvents(): Observable<
    Array<TransportDiscoveredDevice>
  > {
    return new Observable((subscriber) => {
      const eventEmitter = new NativeEventEmitter(this._nativeModule);
      const eventListener = eventEmitter.addListener(
        DISCOVERED_DEVICES_EVENT,
        (discoveredDevices: DiscoveredDevicesEventPayload) => {
          subscriber.next(
            discoveredDevices
              .map((device) =>
                mapNativeDiscoveryDeviceToTransportDiscoveredDevice(
                  device,
                  this._deviceModelDataSource,
                ),
              )
              .filter((d) => d !== null),
          );
        },
      );

      return () => {
        eventListener.remove();
      };
    });
  }

  subscribeToDeviceDisconnectedEvents(): Observable<InternalDeviceDisconnected> {
    return new Observable((subscriber) => {
      const eventEmitter = new NativeEventEmitter(this._nativeModule);
      const eventListener = eventEmitter.addListener(
        DEVICE_DISCONNECTED_EVENT,
        (device: DeviceDisconnectedEventPayload) => {
          subscriber.next(
            mapNativeDeviceConnectionLostToDeviceDisconnected(device),
          );
        },
      );

      return () => {
        eventListener.remove();
      };
    });
  }

  subscribeToTransportLogs(): Observable<LogParams> {
    return new Observable((subscriber) => {
      const eventEmitter = new NativeEventEmitter(this._nativeModule);
      const eventListener = eventEmitter.addListener(
        TRANSPORT_LOG_EVENT,
        (logParams: NativeLog) => {
          subscriber.next(mapNativeTransportLogToLog(logParams));
        },
      );

      return () => {
        eventListener.remove();
      };
    });
  }

  async connectDevice(uid: string): Promise<InternalConnectionResult> {
    const nConnectionResult = await this._nativeModule.connectDevice(uid);
    return mapNativeConnectionResultToConnectionResult(
      nConnectionResult,
      this._deviceModelDataSource,
    );
  }

  async disconnectDevice(sessionId: string): Promise<void> {
    return this._nativeModule.disconnectDevice(sessionId);
  }

  async sendApdu(
    sessionId: string,
    apdu: Uint8Array,
    triggersDisconnection: boolean,
    abortTimeout: number,
  ): Promise<SendApduResult> {
    console.log("______ PERF: _____ SEND APDU CALLED _____");
    console.log("PERF: sendApdu START at ", Date.now());
    const t0 = performance.now();
    const serializedApdu = uint8ArrayToBase64(apdu);
    const t1 = performance.now();
    console.log("PERF: sendApdu serialization", t1 - t0, "ms");
    console.log("PERF: sendApdu call to nativeModule at", t1);
    const nSendApduResult = await this._nativeModule.sendApdu(
      sessionId,
      serializedApdu,
      triggersDisconnection,
      abortTimeout,
    );
    const t2 = performance.now();
    console.log("PERF: sendApdu result from nativeModule at", t2);
    const result = mapNativeSendApduResultToSendApduResult(nSendApduResult)
    const t3 = performance.now();
    console.log("PERF: sendApdu deserialization", t3 - t2, "ms");
    console.log("PERF: TS sendApdu total", t3 - t0, "ms");
    console.log("PERF: sendApdu END at   ", Date.now());
    return result;
  }
}
