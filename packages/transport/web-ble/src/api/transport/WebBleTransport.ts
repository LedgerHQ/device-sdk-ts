import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  type ConnectError,
  DeviceConnectionStateMachine,
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

  private _deviceConnectionsById = new Map<
    string,
    DeviceConnectionStateMachine<WebBleApduSenderDependencies>
  >();
  private _registry = new Map<string, RegistryEntry>();
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

        this._emitDevices();
        return discovered;
      }),
    );
  }

  stopDiscovering(): void {
    /* no-op on Web Bluetooth */
  }

  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    this._emitDevices();
    return this._devices$.asObservable();
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
      const device = entry.device;
      if (!device.gatt) {
        throw new OpeningConnectionError("No GATT server available on device");
      }

      // fresh connect
      if (!device.gatt.connected) {
        await this._withTimeout(
          device.gatt.connect(),
          6000,
          "GATT connect timed out",
        );
        await this._delay(150);
      }

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
          tryToReconnect: () => {
            this.tryToReconnect(params.deviceId, params.onReconnect).catch(
              (e) =>
                this._logger.error("tryToReconnect() threw", { data: { e } }),
            );
          },
          onTerminated: () => {
            try {
              this._deviceConnectionsById
                .get(params.deviceId)
                ?.closeConnection();
              params.onDisconnect(params.deviceId);
            } finally {
              this._deviceConnectionsById.delete(params.deviceId);
              const reg = this._registry.get(params.deviceId);
              if (reg?.listener) {
                try {
                  reg.device.removeEventListener(
                    "gattserverdisconnected",
                    reg.listener,
                  );
                } catch {}
                reg.listener = undefined;
              }
              this._emitDevices();
            }
          },
        });

      await apduSender.setupConnection();

      this._deviceConnectionsById.set(params.deviceId, machine);
      entry.serviceUuid = service.uuid;
      entry.infos = infos;

      const onDisc = (_ev: Event) =>
        this._handleDeviceDisconnected(params.deviceId);
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
      return Left(new OpeningConnectionError(e as any));
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
        try {
          reg.device.removeEventListener(
            "gattserverdisconnected",
            reg.listener,
          );
        } catch {}
        reg.listener = undefined;
      }
      await this._safeCancel(id);
      this._emitDevices();
      return Right(undefined);
    } catch (e) {
      return Left(new GeneralDmkError({ originalError: e as any }));
    }
  }

  // === RN-shaped lifecycle helpers ============================================================

  private _handleDeviceDisconnected(deviceId: string) {
    this._logger.debug(`[${deviceId}] gattserverdisconnected`);
    const sm = this._deviceConnectionsById.get(deviceId);
    if (!sm) return;
    sm.eventDeviceDisconnected();
  }

  private async _waitForInRange(
    device: BluetoothDevice,
    opts: { startTimeoutMs?: number; advTimeoutMs?: number } = {},
  ): Promise<boolean> {
    const { startTimeoutMs = 500, advTimeoutMs = 1500 } = opts;
    if (typeof device.watchAdvertisements !== "function") return false;

    // 1) Start watching, but cap how long we wait for it to start
    const controller = new AbortController();
    const startTimer = setTimeout(() => controller.abort(), startTimeoutMs);
    const started = await device
      .watchAdvertisements({ signal: controller.signal })
      .then(() => true)
      .catch(() => false);
    clearTimeout(startTimer);
    if (!started) return false;

    // 2) Wait for the first advertisement or time out
    const seen = await new Promise<boolean>((resolve) => {
      const onAdv = () => {
        device.removeEventListener("advertisementreceived", onAdv);
        resolve(true);
      };
      device.addEventListener("advertisementreceived", onAdv);
      setTimeout(() => {
        device.removeEventListener("advertisementreceived", onAdv);
        resolve(false);
      }, advTimeoutMs);
    });

    // 3) Stop watching to avoid keeping a long-lived scan
    try {
      controller.abort();
    } catch {}
    return seen;
  }

  private async _rediscoverDevice(
    deviceId: string,
  ): Promise<BluetoothDevice | null> {
    if (typeof navigator.bluetooth.getDevices !== "function") return null;
    try {
      this._logger.debug(`Attempting to rediscover device ${deviceId}`);
      const permitted = await navigator.bluetooth.getDevices();
      let fresh = permitted.find((d) => d.id === deviceId) ?? null;

      if (!fresh) {
        const name = this._registry.get(deviceId)?.device?.name;
        if (name) fresh = permitted.find((d) => d.name === name) ?? null;
      }

      if (fresh) {
        // Only if you *need* to ensure it's in range before connecting:
        const inRange = await this._waitForInRange(fresh, {
          startTimeoutMs: 400,
          advTimeoutMs: 1200,
        });
        this._logger.debug(`Rediscovered ${fresh.id}, inRange=${inRange}`);
      }
      return fresh;
    } catch {
      return null;
    }
  }

  // private async _primeAdvertisementWatch(device: BluetoothDevice) {
  //   const canWatch = typeof device.watchAdvertisements === "function";
  //   if (!canWatch) {
  //     this._logger.debug(`CAN'T WATCH ADVERTISEMENTS FOR DEVICE ${device.id}`);
  //     return;
  //   }

  //   // Optional: guard so we don't call it repeatedly per device
  //   // if (this._advPrimed.has(device.id)) return;
  //   // this._advPrimed.add(device.id);

  //   // ✅ Time-box the await so it can't wedge the reconnect loop.
  //   try {
  //     const controller = new AbortController();
  //     const timeout = setTimeout(() => controller.abort(), 1000);
  //     await device.watchAdvertisements({ signal: controller.signal });
  //     clearTimeout(timeout);
  //   } catch (e) {
  //     // AbortError or platform quirk — fine; we only try to improve reconnects.
  //     this._logger.debug(
  //       `watchAdvertisements failed/aborted for ${device.id}`,
  //       { data: { e } },
  //     );
  //   }
  // }

  private async tryToReconnect(
    deviceId: string,
    onReconnect?: (id: string) => Promise<void> | void,
  ) {
    await this._safeCancel(deviceId);

    while (true) {
      const reg = this._registry.get(deviceId);
      const sm = this._deviceConnectionsById.get(deviceId);
      if (!reg || !sm) {
        this._logger.debug(
          `[${deviceId}] aborting reconnect: registry or SM missing`,
        );
        return;
      }

      try {
        const device = await this._withTimeout(
          this._rediscoverDevice(deviceId),
          3000,
          "rediscovery timeout",
        );

        if (!device) throw new Error("Device not found");

        if (!device.gatt) throw new Error("No GATT on device");
        try {
          device.gatt.connect();
        } catch (e) {
          this._logger.error(`[${deviceId}] gatt.connect() failed`, {
            data: { e },
          });
          if (device.gatt?.connected) device.gatt.disconnect();
        }

        const { service, infos } = await this._getLiveLedgerService(device);
        const { writeCharacteristic, notifyCharacteristic } =
          await this._resolveCharacteristics(service, infos);

        sm.setDependencies({ writeCharacteristic, notifyCharacteristic });
        await sm.setupConnection();
        sm.eventDeviceConnected();

        reg.serviceUuid = service.uuid;
        reg.infos = infos;

        if (reg.listener) {
          try {
            device.removeEventListener("gattserverdisconnected", reg.listener);
          } catch {}
        }
        const onDisc = (_: Event) => this._handleDeviceDisconnected(deviceId);
        device.addEventListener("gattserverdisconnected", onDisc);
        reg.listener = onDisc;

        try {
          await onReconnect?.(deviceId);
        } catch (e) {
          this._logger.error("onReconnect callback threw", { data: { e } });
        }

        this._emitDevices();
        return; // ✅ success: end function
      } catch (e) {
        this._logger.error(`[${deviceId}] reconnect attempt failed`, {
          data: { e },
        });
        try {
          if (reg?.device.gatt?.connected) reg.device.gatt.disconnect();
        } catch {}
        await this._delay(500);
        continue; // 🔁 next attempt
      }
    }

    // only reached if all attempts failed
    // this._logger.error(
    //   `[${deviceId}] all reconnection attempts failed – closing session`,
    // );
    // this._deviceConnectionsById.get(deviceId)?.closeConnection();
  }

  private async _safeCancel(deviceId: string) {
    const reg = this._registry.get(deviceId);
    if (!reg) return;
    try {
      if (reg.device.gatt?.connected) reg.device.gatt.disconnect();
    } catch {}
    await this._delay(100);
  }

  // === Service/characteristic resolution ======================================================

  private async _identifyLedgerService(device: BluetoothDevice): Promise<{
    serviceUuid: string;
    infos: NonNullable<RegistryEntry["infos"]>;
  }> {
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
      } catch {}
      await this._delay(200);
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
    // Prefer the CMD UUID (without response), then the legacy write UUID.
    const order = [infos.writeCmdUuid, infos.writeUuid].filter(
      Boolean,
    ) as string[];
    const tried: BluetoothRemoteGATTCharacteristic[] = [];

    for (const uuid of order) {
      try {
        const ch = await svc.getCharacteristic(uuid);
        tried.push(ch);

        // Prefer characteristics that support without-response
        if (ch.properties.writeWithoutResponse) return ch;
        // Otherwise accept normal write
        if (ch.properties.write) return ch;
      } catch {
        // keep trying
      }
    }

    if (tried.length) return tried[0]!;
    throw new OpeningConnectionError("No write characteristic available");
  }

  // === misc ===================================================================================

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

  private _withTimeout<T>(
    p: Promise<T>,
    ms: number,
    msg: string,
    cancellationFn?: () => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => {
        reject(new OpeningConnectionError(msg));
        try {
          cancellationFn?.();
        } catch {
          this._logger.debug("Cancellation function threw");
        }
      }, ms);
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          this._logger.error("_withTimeout() promise rejected", {
            data: { e },
          });
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
