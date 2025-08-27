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

import { RECONNECT_DEVICE_TIMEOUT } from "@api/data/WebBleConfig";

import {
  WebBleApduSender,
  type WebBleApduSenderDependencies,
} from "./WebBleApduSender";

export const webBleIdentifier: TransportIdentifier = "WEB-BLE-RN-STYLE";

type RegistryEntry = {
  device: BluetoothDevice;
  serviceUuid?: string;
  infos?: {
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

  private _advPrimed = new Set<string>();
  private async _primeAdvertisementWatch(device: BluetoothDevice) {
    if (this._advPrimed.has(device.id)) return;
    const canWatch = typeof device.watchAdvertisements === "function";
    if (!canWatch) return;
    try {
      await device.watchAdvertisements();
    } catch {
      /* ignore */
    }
    this._advPrimed.add(device.id);
  }

  private _deviceConnectionsById = new Map<
    string,
    DeviceConnectionStateMachine<WebBleApduSenderDependencies>
  >();

  private _registry = new Map<string, RegistryEntry>();
  private _reconnecting = new Set<string>();

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

  startDiscovering(): Observable<TransportDiscoveredDevice> {
    const filters = this._deviceModelDataSource
      .getBluetoothServices()
      .map((s) => ({ services: [s] }));
    const allUuids = this._deviceModelDataSource.getBluetoothServices();

    return from(
      navigator.bluetooth.requestDevice({
        filters,
        optionalServices: allUuids,
      }),
    ).pipe(
      switchMap(async (device) => {
        const { serviceUuid, infos } =
          await this._identifyLedgerService(device);

        const discovered: TransportDiscoveredDevice = {
          id: device.id,
          deviceModel: infos.deviceModel,
          transport: webBleIdentifier,
        };

        this._registry.set(device.id, {
          device,
          serviceUuid,
          infos,
          discovered,
        });

        this._primeAdvertisementWatch(device).catch(() => {});

        this._emitDevices();
        return discovered;
      }),
    );
  }

  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    this._emitDevices();
    return this._devices$.asObservable();
  }

  stopDiscovering(): void {
    /* no passive background scan on Web Bluetooth */
  }

  async connect(params: {
    deviceId: string;
    onDisconnect: (deviceId: string) => void;
    onReconnect?: (deviceId: string) => Promise<void> | void;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    const existing = this._deviceConnectionsById.get(params.deviceId);
    const entry = this._registry.get(params.deviceId);
    if (!entry)
      return Left(new UnknownDeviceError(`Unknown device ${params.deviceId}`));

    if (existing) {
      return Right(
        new TransportConnectedDevice({
          id: params.deviceId,
          deviceModel: entry.infos!.deviceModel,
          type: "BLE",
          transport: webBleIdentifier,
          sendApdu: (...a) => existing.sendApdu(...a),
        }),
      );
    }

    try {
      //  check for have a live GATT connection
      const device = entry.device;
      if (!device.gatt) {
        throw new OpeningConnectionError("No GATT server available on device");
      }

      if (!device.gatt.connected) {
        await this._withTimeout(
          device.gatt.connect(),
          6000,
          "GATT connect timed out",
        );
        await this._delay(200);
      }

      // find service and characteristics
      const { service, infos } = await this._getLiveLedgerService(device);
      const { writeCharacteristic, notifyCharacteristic } =
        await this._resolveCharacteristics(service, infos);

      const apduSender = new WebBleApduSender(
        {
          writeCharacteristic,
          notifyCharacteristic,
          apduSenderFactory: this._apduSenderFactory,
          apduReceiverFactory: this._apduReceiverFactory,
        },
        this.loggerFactory,
      );

      const machine =
        new DeviceConnectionStateMachine<WebBleApduSenderDependencies>({
          deviceId: params.deviceId,
          deviceApduSender: apduSender,
          timeoutDuration: RECONNECT_DEVICE_TIMEOUT,
          tryToReconnect: (budgetMs) => {
            this.tryToReconnect(
              params.deviceId,
              params.onReconnect,
              budgetMs,
            ).catch((e) =>
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

      // start notifications and MTU handshake before exposing the connection
      await apduSender.setupConnection();
      await this._primeAdvertisementWatch(device);

      // track connection
      this._deviceConnectionsById.set(params.deviceId, machine);
      entry.serviceUuid = service.uuid;
      entry.infos = infos;

      // hook disconnection event
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
          sendApdu: (...a) => machine.sendApdu(...a),
        }),
      );
    } catch (e) {
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
        try {
          reg.device.gatt.disconnect();
        } catch {
          /* ignore */
        }
      }
      this._emitDevices();
      return Right(undefined);
    } catch (e) {
      return Left(new GeneralDmkError({ originalError: e }));
    }
  }

  private _handleDeviceDisconnected(
    deviceId: string,
    _onReconnect?: (deviceId: string) => Promise<void> | void,
  ) {
    this._logger.debug(`[${deviceId}] gattserverdisconnected`);
    const sm = this._deviceConnectionsById.get(deviceId);
    if (!sm) return;
    sm.eventDeviceDisconnected();
  }

  private async _sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async _waitUntilGattReady(
    device: BluetoothDevice,
    opts: { timeoutMs?: number; stableMs?: number; pollMs?: number } = {},
  ): Promise<void> {
    const timeoutMs = opts.timeoutMs ?? 10_000;
    const stableMs = opts.stableMs ?? 500;
    const pollMs = opts.pollMs ?? 100;

    const deadline = Date.now() + timeoutMs;
    let stableStart: number | null = null;

    while (Date.now() < deadline) {
      // GATT must exist
      if (!device.gatt) {
        stableStart = null;
        await this._sleep(pollMs);
        continue;
      }
      // must be disconnected
      if (device.gatt.connected) {
        stableStart = null;
        await this._sleep(pollMs);
        continue;
      }
      // require small stability window
      if (stableStart == null) {
        stableStart = Date.now();
      }
      if (Date.now() - stableStart < stableMs) {
        await this._sleep(pollMs);
        continue;
      }
      return;
    }
    throw new OpeningConnectionError("Timed out waiting for GATT to be ready");
  }

  private async _waitForAdvertisementOrDelay(
    device: BluetoothDevice,
    { timeoutMs = 5000 }: { timeoutMs?: number } = {},
  ): Promise<void> {
    const canWatch = typeof device.watchAdvertisements === "function";
    if (!canWatch) {
      await this._sleep(Math.min(timeoutMs, 2500));
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      const onAdv = () => {
        device.removeEventListener("advertisementreceived", onAdv);
        done();
      };

      const setupWatch = async () => {
        try {
          device.addEventListener("advertisementreceived", onAdv);
          await device.watchAdvertisements();
        } catch {
          done();
          return;
        }
      };

      setupWatch();
      setTimeout(done, timeoutMs);
    });
  }

  private async tryToReconnect(
    deviceId: string,
    onReconnect?: (id: string) => Promise<void> | void,
    budgetMs: number = RECONNECT_DEVICE_TIMEOUT,
  ) {
    if (this._reconnecting.has(deviceId)) return;
    this._reconnecting.add(deviceId);

    try {
      const reg = this._registry.get(deviceId);
      const sm = this._deviceConnectionsById.get(deviceId);
      if (!reg || !sm) return;

      const { device } = reg;
      const deadline = Date.now() + Math.max(0, budgetMs);
      let attempt = 0;

      while (Date.now() < deadline) {
        attempt += 1;
        try {
          // ensure link is down
          try {
            if (device.gatt?.connected) device.gatt.disconnect();
          } catch {
            /* ignore */
          }

          await this._waitForAdvertisementOrDelay(device, {
            timeoutMs: Math.min(4000, Math.max(1000, deadline - Date.now())),
          });

          await this._waitUntilGattReady(device, {
            timeoutMs: Math.min(2500, deadline - Date.now()),
            stableMs: 900,
            pollMs: 100,
          });

          await this._withTimeout(
            device.gatt!.connect(),
            Math.min(4000, Math.max(1000, deadline - Date.now())),
            "connect timed out",
            () => device.gatt!.disconnect(),
          );

          // helps some stacks (not sure is valid)
          try {
            await device.gatt!.getPrimaryServices();
          } catch {
            /* ignore */
          }
          await this._primeAdvertisementWatch(device);

          // rehydrate service and characteristics
          const { service, infos } = await this._getLiveLedgerService(device);
          const { writeCharacteristic, notifyCharacteristic } =
            await this._resolveCharacteristics(service, infos);

          sm.setDependencies({ writeCharacteristic, notifyCharacteristic });

          // refresh listener
          if (reg.listener)
            device.removeEventListener("gattserverdisconnected", reg.listener);
          const onDisc = (_: Event) =>
            this._handleDeviceDisconnected(deviceId, onReconnect);
          device.addEventListener("gattserverdisconnected", onDisc);
          reg.listener = onDisc;
          reg.serviceUuid = service.uuid;
          reg.infos = infos;

          await sm.setupConnection();
          sm.eventDeviceConnected();

          try {
            await onReconnect?.(deviceId);
          } catch (e) {
            this._logger.error("onReconnect callback threw", { data: { e } });
          }

          this._emitDevices();
          return; // yay
        } catch (e: unknown) {
          const msg = String((e as Error)?.message || "").toLowerCase();
          const name = String((e as Error)?.name || "");
          const isRange =
            name === "NetworkError" && msg.includes("no longer in range");
          const backoff = isRange ? 600 + 200 * attempt : 250 * attempt;
          const remaining = deadline - Date.now();
          if (remaining > 0)
            await this._delay(Math.min(backoff, Math.max(100, remaining)));
        }
      }

      this._logger.error(`[${deviceId}] reconnection budget exhausted`);
      try {
        sm.closeConnection();
      } catch {
        /* ignore */
      }
    } finally {
      this._reconnecting.delete(deviceId);
    }
  }

  private _emitDevices() {
    const connected: TransportDiscoveredDevice[] = [];
    for (const [id] of this._deviceConnectionsById) {
      const reg = this._registry.get(id);
      if (reg?.infos) {
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

  private async _identifyLedgerService(device: BluetoothDevice): Promise<{
    serviceUuid: string;
    infos: NonNullable<RegistryEntry["infos"]>;
  }> {
    // connect briefly, read service, disconnect
    if (!device.gatt) {
      throw new OpeningConnectionError("No GATT server available on device");
    }
    try {
      await this._withTimeout(device.gatt.connect(), 6000, "connect timeout");
      const { service, infos } = await this._getLiveLedgerService(device);
      return { serviceUuid: service.uuid, infos };
    } finally {
      try {
        device.gatt?.disconnect();
      } catch {
        /* ignore */
      }
    }
  }

  private async _getLiveLedgerService(device: BluetoothDevice): Promise<{
    service: BluetoothRemoteGATTService;
    infos: NonNullable<RegistryEntry["infos"]>;
  }> {
    const knownUuids = this._deviceModelDataSource.getBluetoothServices();
    const last = this._registry.get(device.id)?.serviceUuid;
    const order = last
      ? [last, ...knownUuids.filter((u) => u !== last)]
      : knownUuids.slice();

    for (const uuid of order) {
      try {
        const s = await device.gatt!.getPrimaryService(uuid);
        const infos =
          this._deviceModelDataSource.getBluetoothServicesInfos()[s.uuid];
        if (!infos) throw new UnknownDeviceError(device.name || "");
        return { service: s, infos };
      } catch (e: unknown) {
        if ((e as Error)?.name === "SecurityError") {
          throw new OpeningConnectionError(
            `Missing Web Bluetooth permission for service ${uuid}. ` +
              `Add it to optionalServices in requestDevice().`,
          );
        }
        try {
          const all = await device.gatt!.getPrimaryServices();
          const found = all.find(
            (s) => s.uuid.toLowerCase() === uuid.toLowerCase(),
          );
          if (found) {
            const infos =
              this._deviceModelDataSource.getBluetoothServicesInfos()[
                found.uuid
              ];
            if (!infos) throw new UnknownDeviceError(device.name || "");
            return { service: found, infos };
          }
        } catch {
          /* continue */
        }
      }
    }
    throw new OpeningConnectionError("Ledger GATT service not found");
  }

  private async _resolveCharacteristics(
    service: BluetoothRemoteGATTService,
    infos: NonNullable<RegistryEntry["infos"]>,
  ): Promise<{
    writeCharacteristic: BluetoothRemoteGATTCharacteristic;
    notifyCharacteristic: BluetoothRemoteGATTCharacteristic;
  }> {
    const notifyCharacteristic = await service.getCharacteristic(
      infos.notifyUuid,
    );
    const writeCharacteristic = await this._pluckWriteCharacteristic(
      service,
      infos,
    );
    return { writeCharacteristic, notifyCharacteristic };
  }

  private async _pluckWriteCharacteristic(
    svc: BluetoothRemoteGATTService,
    infos: NonNullable<RegistryEntry["infos"]>,
  ): Promise<BluetoothRemoteGATTCharacteristic> {
    const tried: BluetoothRemoteGATTCharacteristic[] = [];
    const uuids = Array.from(
      new Set([infos.writeUuid, infos.writeCmdUuid].filter(Boolean)),
    ) as string[];

    for (const uuid of uuids) {
      try {
        const ch = await svc.getCharacteristic(uuid);
        tried.push(ch);
        // prefer characteristics advertising "write" (with response)
        if (ch.properties.write) return ch;
      } catch {
        // continue
      }
    }
    if (tried.length > 0) return tried[0]!;
    throw new OpeningConnectionError("No write characteristic available");
  }

  private _withTimeout<T>(
    p: Promise<T>,
    ms: number,
    msg: string,
    cancellationFn?: () => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => {
        reject(new OpeningConnectionError(msg));
        cancellationFn?.();
      }, ms);
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          console.log("PROMISE REJECTED!!!!!!!!!!", e);
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
