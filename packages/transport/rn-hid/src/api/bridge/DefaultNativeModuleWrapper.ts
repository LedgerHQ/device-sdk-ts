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
    const nSendApduResult = await this._nativeModule.sendApdu(
      sessionId,
      uint8ArrayToBase64(apdu),
      triggersDisconnection,
      abortTimeout,
    );
    return mapNativeSendApduResultToSendApduResult(nSendApduResult);
  }
}
