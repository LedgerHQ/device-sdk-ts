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

import { RECONNECT_DEVICE_TIMEOUT } from "@api/data/WebBleConfig";

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

  private _advPrimed = new Set<string>();
  private async _primeAdvertisementWatch(device: BluetoothDevice) {
    if (this._advPrimed.has(device.id)) return;
    const canWatch = typeof (device as any).watchAdvertisements === "function";
    if (!canWatch) return;
    try {
      await (device as any).watchAdvertisements();
    } catch {
      /* ignore */
    }
    this._advPrimed.add(device.id);
  }

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
    const allUuids = this._deviceModelDataSource.getBluetoothServices();

    return from(
      navigator.bluetooth.requestDevice({
        filters,
        optionalServices: allUuids,
      }),
    ).pipe(
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
          tryToReconnect: (budgetMs: number) => {
            // ✅ accept budget
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

      await apduSender.setupConnection();
      await this._primeAdvertisementWatch(entry.device);

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

  /**
   * Wait until it's reasonable to call device.gatt.connect().
   * - Does NOT call connect() itself.
   * - Does NOT use watchAdvertisements().
   * - Waits for GATT to exist and stay disconnected for a small "stable" window.
   */
  private async _waitUntilGattReady(
    device: BluetoothDevice,
    opts: { timeoutMs?: number; stableMs?: number; pollMs?: number } = {},
  ): Promise<void> {
    const timeoutMs = opts.timeoutMs ?? 10_000;
    const stableMs = opts.stableMs ?? 500; // how long "disconnected" must be stable
    const pollMs = opts.pollMs ?? 100; // recursion cadence

    const deadline = Date.now() + timeoutMs;
    let stableStart: number | null = null;

    const loop = async (): Promise<void> => {
      if (Date.now() >= deadline) {
        throw new OpeningConnectionError(
          "Timed out waiting for GATT to be ready",
        );
      }

      // 1) GATT object must exist
      if (!device.gatt) {
        stableStart = null;
        await this._sleep(pollMs);
        return loop();
      }

      // 2) Must not be connected (let OS fully release the link)
      if (device.gatt.connected) {
        stableStart = null; // reset stability window
        await this._sleep(pollMs);
        return loop();
      }

      // 3) Disconnected — require a short stability window (avoids calling connect too soon)
      if (stableStart == null) {
        stableStart = Date.now();
      }
      if (Date.now() - (stableStart ?? 0) < stableMs) {
        await this._sleep(pollMs);
        return loop();
      }

      // Passed all checks: considered "ready"
      return;
    };

    await loop();
  }

  private async _waitForAdvertisementOrDelay(
    device: BluetoothDevice,
    { timeoutMs = 5000 }: { timeoutMs?: number } = {},
  ): Promise<void> {
    const canWatch = typeof (device as any).watchAdvertisements === "function";
    if (!canWatch) {
      // fallback: just give the stack some time to come back
      await this._sleep(Math.min(timeoutMs, 2500));
      return;
    }

    await new Promise<void>(async (resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      const onAdv = () => {
        device.removeEventListener("advertisementreceived", onAdv as any);
        done();
      };

      try {
        device.addEventListener("advertisementreceived", onAdv as any);
        await (device as any).watchAdvertisements();
      } catch {
        // permission/platform issue; fall back to time
        done();
        return;
      }
      setTimeout(done, timeoutMs);
    });
  }

  private async tryToReconnect(
    deviceId: string,
    onReconnect?: (id: string) => Promise<void> | void,
    budgetMs: number = RECONNECT_DEVICE_TIMEOUT, // ✅ use SM budget
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
    const deadline = Date.now() + Math.max(0, budgetMs);
    let attempt = 0;

    while (Date.now() < deadline) {
      attempt += 1;
      try {
        if (device.gatt?.connected) {
          try {
            device.gatt.disconnect();
          } catch {}
        }
        await this._waitForAdvertisementOrDelay(device, {
          timeoutMs: Math.min(5000, Math.max(1500, deadline - Date.now())),
        });

        await this._waitUntilGattReady(device, {
          timeoutMs: Math.min(2500, deadline - Date.now()),
          stableMs: 900,
          pollMs: 100,
        });

        await this._withTimeout(
          device.gatt!.connect(),
          Math.min(4000, Math.max(1500, deadline - Date.now())),
          "connect timed out",
        );

        try {
          await device.gatt!.getPrimaryServices();
        } catch {}
        await this._primeAdvertisementWatch(device);

        // --- rehydrate characteristics (unchanged) ---
        const svc = await this._findAnyLedgerService(device);
        const infos =
          this._deviceModelDataSource.getBluetoothServicesInfos()[svc.uuid];
        if (!infos)
          throw new OpeningConnectionError(
            "Unknown Ledger service after reconnect",
          );

        const writeCharacteristic = await this._pluckWriteCharacteristic(
          svc,
          infos,
        );
        const notifyCharacteristic = await svc.getCharacteristic(
          infos.notifyUuid,
        );
        sm.setDependencies({ writeCharacteristic, notifyCharacteristic });

        if (reg.listener)
          device.removeEventListener("gattserverdisconnected", reg.listener);
        const onDisc = (_: Event) =>
          this._handleDeviceDisconnected(deviceId, onReconnect);
        device.addEventListener("gattserverdisconnected", onDisc);
        reg.listener = onDisc;
        reg.service = svc;
        reg.infos = infos;

        await sm.setupConnection();
        sm.eventDeviceConnected();
        try {
          await onReconnect?.(deviceId);
        } catch (e) {
          this._logger.error("onReconnect callback threw", { data: { e } });
        }
        this._emitDevices();
        this._reconnecting.delete(deviceId);
        return; // ✅ success
      } catch (e: any) {
        const msg = String(e?.message || "").toLowerCase();
        const name = String(e?.name || "");
        const isRange =
          name === "NetworkError" && msg.includes("no longer in range");
        // Backoff a bit longer for old-firmware app switches (radio dark period)
        const backoff = isRange ? 600 + 200 * attempt : 250 * attempt;
        const remaining = deadline - Date.now();
        if (remaining > 0)
          await this._delay(Math.min(backoff, Math.max(100, remaining)));
      }
    }

    this._logger.error(`[${deviceId}] reconnection budget exhausted`);
    try {
      sm.closeConnection();
    } catch {}
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

  private async _findAnyLedgerService(device: BluetoothDevice) {
    const uuids = this._deviceModelDataSource.getBluetoothServices();
    const last = this._registry.get(device.id)?.service?.uuid;
    const order = last
      ? [last, ...uuids.filter((u) => u !== last)]
      : uuids.slice();

    for (const uuid of order) {
      try {
        return await device.gatt!.getPrimaryService(uuid);
      } catch (e: any) {
        // If we lack permission for this UUID, don’t hide it as “not found”
        if (e?.name === "SecurityError") {
          throw new OpeningConnectionError(
            `Missing Web Bluetooth permission for service ${uuid}. ` +
              `Add it to optionalServices in requestDevice().`,
          );
        }
        // else try slower path
      }
      try {
        const all = await device.gatt!.getPrimaryServices();
        const found = all.find(
          (s) => s.uuid.toLowerCase() === uuid.toLowerCase(),
        );
        if (found) return found;
      } catch {
        /* continue */
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
