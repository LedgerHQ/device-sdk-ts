import { NativeEventEmitter, NativeModules } from "react-native";
import {
  type DeviceModelDataSource,
  type TransportDiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { Observable } from "rxjs";

import { uint8ArrayToBase64 } from "@api/helpers/uint8ArrayToBase64";
import { type NativeModuleWrapper } from "@api/transport/NativeModuleWrapper";
import {
  type ConnectionResult,
  type Log,
  type SendApduResult,
} from "@api/transport/types";

import {
  mapNativeConnectionResultToConnectionResult,
  mapNativeDiscoveryDeviceToTransportDiscoveredDevice,
  mapNativeSendApduResultToSendApduResult,
  mapNativeTransportLogToLog,
} from "./mapper";
import {
  DISCOVERED_DEVICES_EVENT,
  type DiscoveredDevicesEventPayload,
  type NativeLog,
} from "./types";
import { type NativeTransportModuleType } from "./types";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const NativeTransportModule: NativeTransportModuleType =
  NativeModules["RCTTransportHIDModule"];

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
    return NativeTransportModule.startScan();
  }

  stopScan() {
    return NativeTransportModule.stopScan();
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

  subscribeToTransportLogs(): Observable<Log> {
    return new Observable((subscriber) => {
      const eventEmitter = new NativeEventEmitter(this._nativeModule);
      const eventListener = eventEmitter.addListener(
        "log",
        (logParams: NativeLog) => {
          subscriber.next(mapNativeTransportLogToLog(logParams));
        },
      );

      return () => {
        eventListener.remove();
      };
    });
  }

  async connectDevice(uid: string): Promise<ConnectionResult> {
    const nConnectionResult = await NativeTransportModule.connectDevice(uid);
    return mapNativeConnectionResultToConnectionResult(
      nConnectionResult,
      this._deviceModelDataSource,
    );
  }

  async disconnectDevice(sessionId: string): Promise<void> {
    return NativeTransportModule.disconnectDevice(sessionId);
  }

  async sendApdu(sessionId: string, apdu: Uint8Array): Promise<SendApduResult> {
    const nSendApduResult = await NativeTransportModule.sendApdu(
      sessionId,
      uint8ArrayToBase64(apdu),
    );
    return mapNativeSendApduResultToSendApduResult(nSendApduResult);
  }
}
