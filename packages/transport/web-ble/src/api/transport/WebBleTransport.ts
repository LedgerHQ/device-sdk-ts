// WebBleTransportRnStyle.ts
import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  type ConnectError,
  type DeviceModelDataSource,
  type DmkError,
  GeneralDmkError,
  type LoggerPublisherService,
  OpeningConnectionError,
  type Transport,
  TransportConnectedDevice,
  type TransportDeviceModel,
  type TransportDiscoveredDevice,
  type TransportFactory,
  type TransportIdentifier,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { DeviceConnectionStateMachine } from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { BehaviorSubject, from, type Observable } from "rxjs";
import { switchMap } from "rxjs/operators";

import {
  RECONNECT_DEVICE_TIMEOUT,
  RECONNECTION_RETRY_COUNT,
  SINGLE_RECONNECTION_TIMEOUT,
} from "@api/data/WebBleConfig";

import {
  WebBleApduSender,
  type WebBleApduSenderDependencies,
} from "./WebBleApduSender";

export const webBleIdentifier: TransportIdentifier = "WEB-BLE-RN-STYLE";

type RegistryEntry = {
  device: BluetoothDevice;
  service: BluetoothRemoteGATTService;
  infos: {
    writeCmdUuid: string;
    writeUuid?: string;
    notifyUuid: string;
    deviceModel: TransportDeviceModel;
  };
  discovered: TransportDiscoveredDevice;
  listener?: (ev: Event) => void;
};

export class WebBleTransport implements Transport {
  private _logger: LoggerPublisherService;
  private _deviceModelDataSource: DeviceModelDataSource;
  private _apduSenderFactory: ApduSenderServiceFactory;
  private _apduReceiverFactory: ApduReceiverServiceFactory;

  // RN-style: one SM per device, no external timers/promises
  private _deviceConnectionsById = new Map<
    string,
    DeviceConnectionStateMachine<WebBleApduSenderDependencies>
  >();

  private _registry = new Map<string, RegistryEntry>();
  private _reconnecting = new Set<string>(); // prevent parallel reconnects

  // Emits the merged list (connected + discovered)
  private _devices$ = new BehaviorSubject<TransportDiscoveredDevice[]>([]);

  constructor(
    deviceModelDataSource: DeviceModelDataSource,
    private loggerFactory: (tag: string) => LoggerPublisherService,
    apduSenderFactory: ApduSenderServiceFactory,
    apduReceiverFactory: ApduReceiverServiceFactory,
  ) {
    this._deviceModelDataSource = deviceModelDataSource;
    this._apduSenderFactory = apduSenderFactory;
    this._apduReceiverFactory = apduReceiverFactory;
    this._logger = loggerFactory("WebBleTransportRnStyle");
  }

  isSupported(): boolean {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
  }

  getIdentifier(): TransportIdentifier {
    return webBleIdentifier;
  }

  /**
   * One-shot picker (must be called from a user gesture).
   * Adds the selected device to the registry and emits through listenToAvailableDevices().
   */
  startDiscovering(): Observable<TransportDiscoveredDevice> {
    const filters = this._deviceModelDataSource
      .getBluetoothServices()
      .map((s) => ({ services: [s] }));

    return from(navigator.bluetooth.requestDevice({ filters })).pipe(
      switchMap(async (device) => {
        if (!device.gatt)
          throw new OpeningConnectionError(
            "No GATT server available on device",
          );

        const server = await device.gatt.connect();

        // Find any known Ledger service on this device
        const knownUuids = this._deviceModelDataSource.getBluetoothServices();
        let service: BluetoothRemoteGATTService | null = null;
        for (const uuid of knownUuids) {
          try {
            service = await server.getPrimaryService(uuid);
            break;
          } catch {
            /* ignore */
          }
        }
        if (!service) {
          throw new OpeningConnectionError("Ledger GATT service not found");
        }

        const infos =
          this._deviceModelDataSource.getBluetoothServicesInfos()[service.uuid];
        if (!infos) throw new UnknownDeviceError(device.name || "");

        const id = device.id;
        const discovered: TransportDiscoveredDevice = {
          id,
          deviceModel: infos.deviceModel,
          transport: webBleIdentifier,
        };

        this._registry.set(id, { device, service, infos, discovered });
        this._emitDevices();
        return discovered;
      }),
    );
  }

  /**
   * Web cannot passively scan. This observable emits:
   *  - currently connected devices, plus
   *  - any devices you add via startDiscovering().
   * Call startDiscovering() from a user gesture to add more devices.
   */
  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    // Emit current snapshot immediately
    this._emitDevices();
    return this._devices$.asObservable();
  }

  stopDiscovering(): void {
    /* no-op (Web Bluetooth has no background scan to stop) */
  }

  async connect(params: {
    deviceId: string;
    onDisconnect: (deviceId: string) => void;
    onReconnect?: (deviceId: string) => Promise<void> | void;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    const existing = this._deviceConnectionsById.get(params.deviceId);
    if (existing) {
      const entry = this._registry.get(params.deviceId);
      if (!entry)
        return Left(
          new UnknownDeviceError(`Unknown device ${params.deviceId}`),
        );
      return Right(
        new TransportConnectedDevice({
          id: params.deviceId,
          deviceModel: entry.infos.deviceModel,
          type: "BLE",
          transport: webBleIdentifier,
          sendApdu: (...a) => existing.sendApdu(...a),
        }),
      );
    }

    const entry = this._registry.get(params.deviceId);
    if (!entry)
      return Left(new UnknownDeviceError(`Unknown device ${params.deviceId}`));

    try {
      const { device } = entry;
      if (!device.gatt?.connected) {
        await device.gatt!.connect();
        await this._delay(250); // give Chrome a moment
      }

      // Find the live service and proper characteristics
      const service = await this._findAnyLedgerService(device);
      const infos =
        this._deviceModelDataSource.getBluetoothServicesInfos()[service.uuid];
      if (!infos) throw new OpeningConnectionError("Unknown Ledger service");

      const writeCharacteristic = await this._pluckWriteCharacteristic(
        service,
        infos,
      );
      const notifyCharacteristic = await service.getCharacteristic(
        infos.notifyUuid,
      );

      const apduSender = new WebBleApduSender(
        {
          writeCharacteristic,
          notifyCharacteristic,
          apduSenderFactory: this._apduSenderFactory,
          apduReceiverFactory: this._apduReceiverFactory,
        },
        this.loggerFactory,
      );

      const connectionMachine =
        new DeviceConnectionStateMachine<WebBleApduSenderDependencies>({
          deviceId: params.deviceId,
          deviceApduSender: apduSender,
          timeoutDuration: RECONNECT_DEVICE_TIMEOUT,
          tryToReconnect: () => {
            this.tryToReconnect(params.deviceId, params.onReconnect).catch(
              (e: unknown) =>
                this._logger.error("tryToReconnect() threw", { data: { e } }),
            );
          },
          onTerminated: () => {
            try {
              params.onDisconnect(params.deviceId);
            } finally {
              this._deviceConnectionsById.delete(params.deviceId);
              const reg = this._registry.get(params.deviceId);
              if (reg?.listener) {
                reg.device.removeEventListener(
                  "gattserverdisconnected",
                  reg.listener,
                );
                reg.listener = undefined;
              }
              this._emitDevices();
            }
          },
        });

      await apduSender.setupConnection();

      // Track connection
      this._deviceConnectionsById.set(params.deviceId, connectionMachine);
      entry.service = service;
      entry.infos = infos;

      const onDisc = (_ev: Event) =>
        this._handleDeviceDisconnected(params.deviceId, params.onReconnect);
      entry.listener = onDisc;
      device.addEventListener("gattserverdisconnected", onDisc);

      this._emitDevices();

      return Right(
        new TransportConnectedDevice({
          id: params.deviceId,
          deviceModel: infos.deviceModel,
          type: "BLE",
          transport: webBleIdentifier,
          sendApdu: (...a) => connectionMachine.sendApdu(...a),
        }),
      );
    } catch (e: unknown) {
      this._logger.error("connect() error", { data: { e } });
      return Left(new OpeningConnectionError(e));
    }
  }

  async disconnect(params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    const id = params.connectedDevice.id;
    const sm = this._deviceConnectionsById.get(id);
    const reg = this._registry.get(id);
    if (!sm) return Left(new UnknownDeviceError(`Unknown device ${id}`));

    try {
      sm.closeConnection();
      this._deviceConnectionsById.delete(id);
      if (reg?.listener) {
        reg.device.removeEventListener("gattserverdisconnected", reg.listener);
        reg.listener = undefined;
      }
      if (reg?.device.gatt?.connected) {
        reg.device.gatt.disconnect();
      }
      this._emitDevices();
      return Right(undefined);
    } catch (e) {
      return Left(new GeneralDmkError({ originalError: e }));
    }
  }

  // ---------------- RN-style reconnection pipeline ----------------

  private _handleDeviceDisconnected(
    deviceId: string,
    onReconnect?: (deviceId: string) => Promise<void> | void,
  ) {
    this._logger.debug(`[${deviceId}] gattserverdisconnected`);
    const sm = this._deviceConnectionsById.get(deviceId);
    if (!sm) return;

    sm.eventDeviceDisconnected();
    this.tryToReconnect(deviceId, onReconnect).catch((e) =>
      this._logger.error("tryToReconnect failed", { data: { e } }),
    );
  }

  private async tryToReconnect(
    deviceId: string,
    onReconnect?: (deviceId: string) => Promise<void> | void,
  ) {
    if (this._reconnecting.has(deviceId)) return;
    this._reconnecting.add(deviceId);

    const reg = this._registry.get(deviceId);
    const sm = this._deviceConnectionsById.get(deviceId);
    if (!reg || !sm) {
      this._reconnecting.delete(deviceId);
      return;
    }

    const { device } = reg;

    for (let attempt = 1; attempt <= RECONNECTION_RETRY_COUNT; attempt++) {
      try {
        if (device.gatt?.connected) {
          try {
            device.gatt.disconnect();
          } catch {
            /* ignore */
          }
        }

        await this._withTimeout(
          device.gatt!.connect(),
          SINGLE_RECONNECTION_TIMEOUT,
          `connect timed out after ${SINGLE_RECONNECTION_TIMEOUT} ms`,
        );

        await this._delay(200); // let GATT DB populate

        const svc = await this._findAnyLedgerService(device);
        await this._delay(50); // allow characteristics to become queryable
        const infos =
          this._deviceModelDataSource.getBluetoothServicesInfos()[svc.uuid];
        if (!infos)
          throw new OpeningConnectionError(
            "Unknown Ledger service after reconnect",
          );

        // NEW: choose the *right* write characteristic (with-response if available)
        const writeCharacteristic = await this._pluckWriteCharacteristic(
          svc,
          infos,
        );
        const notifyCharacteristic = await svc.getCharacteristic(
          infos.notifyUuid,
        );

        sm.setDependencies({ writeCharacteristic, notifyCharacteristic });

        // Reattach listener & update registry
        if (reg.listener)
          device.removeEventListener("gattserverdisconnected", reg.listener);
        const onDisc = (_ev: Event) =>
          this._handleDeviceDisconnected(deviceId, onReconnect);
        device.addEventListener("gattserverdisconnected", onDisc);
        reg.listener = onDisc;
        reg.service = svc;
        reg.infos = infos;

        await sm.setupConnection(); // triggers MTU probe
        sm.eventDeviceConnected();

        if (onReconnect) {
          try {
            await onReconnect(deviceId);
          } catch (e: unknown) {
            this._logger.error("onReconnect callback threw", { data: { e } });
          }
        }

        this._logger.debug(
          `[${deviceId}] reconnect SUCCESS (attempt ${attempt})`,
        );
        this._emitDevices();
        this._reconnecting.delete(deviceId);
        return;
      } catch (e: unknown) {
        this._logger.warn(`[${deviceId}] reconnect attempt ${attempt} failed`, {
          data: { e },
        });
        await this._delay(Math.min(250 * attempt, 1000));
      }
    }

    this._logger.error(`[${deviceId}] all reconnection attempts failed`);
    try {
      sm.closeConnection();
    } catch {
      /* ignore */
    }
    this._reconnecting.delete(deviceId);
  }

  // ---------------- helpers ----------------

  private _emitDevices() {
    // Connected devices first (like RN), then discovered-but-not-connected
    const connected: TransportDiscoveredDevice[] = [];
    for (const [id] of this._deviceConnectionsById) {
      const reg = this._registry.get(id);
      if (reg) {
        connected.push({
          id,
          deviceModel: reg.infos.deviceModel,
          transport: webBleIdentifier,
        });
      }
    }
    const scanned = Array.from(this._registry.values())
      .map((r) => r.discovered)
      .filter((d) => !this._deviceConnectionsById.has(d.id));

    this._devices$.next([...connected, ...scanned]);
  }

  private async _findAnyLedgerService(
    device: BluetoothDevice,
  ): Promise<BluetoothRemoteGATTService> {
    const uuids = this._deviceModelDataSource.getBluetoothServices();

    // Prefer last-known UUID first
    const last = this._registry.get(device.id)?.service?.uuid;
    const order = last
      ? [last, ...uuids.filter((u) => u !== last)]
      : uuids.slice();

    for (const uuid of order) {
      // First try the direct API
      try {
        return await device.gatt!.getPrimaryService(uuid);
      } catch {
        /* try slower paths below */
      }

      // Some stacks only populate after enumerating all services once
      try {
        const all = await device.gatt!.getPrimaryServices();
        const found = all.find(
          (s) => s.uuid.toLowerCase() === uuid.toLowerCase(),
        );
        if (found) return found;
      } catch {
        /* keep looping */
      }
    }

    throw new OpeningConnectionError(
      "Ledger GATT service not found on reconnect",
    );
  }

  private async _pluckWriteCharacteristic(
    svc: BluetoothRemoteGATTService,
    infos: RegistryEntry["infos"],
  ): Promise<BluetoothRemoteGATTCharacteristic> {
    const tried: BluetoothRemoteGATTCharacteristic[] = [];
    const uuids = Array.from(
      new Set([infos.writeUuid, infos.writeCmdUuid].filter(Boolean)),
    ) as string[];

    for (const uuid of uuids) {
      try {
        const ch = await svc.getCharacteristic(uuid);
        tried.push(ch);
        // Prefer characteristics that advertise "write" (with response)
        // Web Bluetooth's properties can lie after reconnect, so we still keep a fallback.
        // If "write" is present, use it first.
        if (ch.properties.write) return ch;
      } catch {
        /* try next */
      }
    }
    // If none had "write", use the first one that resolved (likely writeCmdUuid)
    if (tried.length > 0) return tried[0]!;

    // As a last resort, throw
    throw new OpeningConnectionError("No write characteristic available");
  }

  private _withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new OpeningConnectionError(msg)), ms);
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        },
      );
    });
  }

  private _delay(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

export const webBleTransportFactory: TransportFactory = ({
  deviceModelDataSource,
  loggerServiceFactory,
  apduSenderServiceFactory,
  apduReceiverServiceFactory,
}) =>
  new WebBleTransport(
    deviceModelDataSource,
    loggerServiceFactory,
    apduSenderServiceFactory,
    apduReceiverServiceFactory,
  );
