import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  type ConnectError,
  DeviceAlreadyConnectedError,
  DeviceDisconnectedWhileSendingError,
  type DeviceModelDataSource,
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
import { defer, from, type Observable, Subject, throwError } from "rxjs";
import { concatMap, retryWhen, scan, tap, timeout } from "rxjs/operators";
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

export const webBleIdentifier: TransportIdentifier = "WEB-BLE";

export class WebBleTransport implements Transport {
  private _logger: LoggerPublisherService;
  private _deviceModelDataSource: DeviceModelDataSource;
  private _apduSenderFactory: ApduSenderServiceFactory;
  private _apduReceiverFactory: ApduReceiverServiceFactory;

  private _deviceRegistry = new Map<
    string,
    {
      device: BluetoothDevice;
      service: BluetoothRemoteGATTService;
      infos: {
        writeCmdUuid: string;
        notifyUuid: string;
        deviceModel: TransportDeviceModel;
      };
      discovered: TransportDiscoveredDevice;
      onDisconnect?: () => void;
      onReconnect?: () => Promise<void> | void;
      listener?: (ev: Event) => void;
    }
  >();

  private _connectionMachines = new Map<
    string,
    DeviceConnectionStateMachine<WebBleApduSenderDependencies>
  >();
  private _discoveredDevicesSubject = new Subject<
    TransportDiscoveredDevice[]
  >();
  private _reconnectionPromises = new Map<
    string,
    { promise: Promise<void>; resolve: () => void }
  >();
  private _reconnectionTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    deviceModelDataSource: DeviceModelDataSource,
    private loggerFactory: (tag: string) => LoggerPublisherService,
    apduSenderFactory: ApduSenderServiceFactory,
    apduReceiverFactory: ApduReceiverServiceFactory,
  ) {
    this._deviceModelDataSource = deviceModelDataSource;
    this._apduSenderFactory = apduSenderFactory;
    this._apduReceiverFactory = apduReceiverFactory;
    this._logger = loggerFactory("WebBleTransport");
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

    return from(navigator.bluetooth.requestDevice({ filters })).pipe(
      switchMap(async (device) => {
        if (!device.gatt)
          throw new OpeningConnectionError(
            "No GATT server available on device",
          );

        const server = await device.gatt.connect();
        const knownUuids = this._deviceModelDataSource.getBluetoothServices();
        let service: BluetoothRemoteGATTService | null = null;

        for (const uuid of knownUuids) {
          try {
            service = await server.getPrimaryService(uuid);
            break;
          } catch {
            this._logger.warn(
              `Service ${uuid} not found on device ${device.name}`,
            );
          }
        }
        if (!service)
          throw new OpeningConnectionError("Ledger GATT service not found");

        const infos =
          this._deviceModelDataSource.getBluetoothServicesInfos()[service.uuid];
        if (!infos) throw new UnknownDeviceError(device.name || "");

        const id = device.id;
        const discovered: TransportDiscoveredDevice = {
          id,
          deviceModel: infos.deviceModel,
          transport: webBleIdentifier,
        };

        this._deviceRegistry.set(id, { device, service, infos, discovered });
        return discovered;
      }),
    );
  }

  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    this.startDiscovering().subscribe({
      next: (d) => this._discoveredDevicesSubject.next([d]),
      error: (e) => this._logger.error("Scan error", { data: { e } }),
    });
    return this._discoveredDevicesSubject.asObservable();
  }

  stopDiscovering(): void {
    // browser prompt cannot be cancelled
  }

  async connect(params: {
    deviceId: string;
    onDisconnect: (deviceId: string) => void;
    onReconnect?: (deviceId: string) => Promise<void> | void;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    const deviceEntry = this._deviceRegistry.get(params.deviceId);

    if (this._connectionMachines.has(params.deviceId)) {
      return Left(new DeviceAlreadyConnectedError("Device already connected"));
    }
    if (!deviceEntry) {
      return Left(new UnknownDeviceError(`Unknown device ${params.deviceId}`));
    }

    try {
      const { device, service, infos, discovered } = deviceEntry;

      const apduSender = new WebBleApduSender(
        {
          writeCharacteristic: await service.getCharacteristic(
            infos.writeCmdUuid,
          ),
          notifyCharacteristic: await service.getCharacteristic(
            infos.notifyUuid,
          ),
          apduSenderFactory: this._apduSenderFactory,
          apduReceiverFactory: this._apduReceiverFactory,
        },
        this.loggerFactory,
      );

      const disconnectHandler = this.handleDisconnect(
        params.deviceId,
        apduSender,
      );

      const connectionMachine =
        new DeviceConnectionStateMachine<WebBleApduSenderDependencies>({
          deviceId: params.deviceId,
          deviceApduSender: apduSender,
          timeoutDuration: RECONNECT_DEVICE_TIMEOUT,
          tryToReconnect: () => {
            disconnectHandler();
          },
          onTerminated: () => {
            try {
              params.onDisconnect(params.deviceId);
              this._connectionMachines.delete(params.deviceId);
              const t = this._reconnectionTimers.get(params.deviceId);
              if (t) {
                clearTimeout(t);
                this._reconnectionTimers.delete(params.deviceId);
              }
            } catch (e) {
              this._logger.error("Error during onTerminated cleanup", {
                data: { error: e },
              });
            }
          },
        });

      await connectionMachine.setupConnection();

      deviceEntry.onDisconnect = () => params.onDisconnect(params.deviceId);
      deviceEntry.onReconnect =
        params.onReconnect && (() => params.onReconnect!(params.deviceId));
      this._connectionMachines.set(params.deviceId, connectionMachine);

      deviceEntry.listener = disconnectHandler;
      device.addEventListener("gattserverdisconnected", deviceEntry.listener);

      return Right(
        new TransportConnectedDevice({
          id: params.deviceId,
          deviceModel: discovered.deviceModel,
          type: "BLE",
          transport: webBleIdentifier,
          sendApdu: async (apdu, triggersDisconnection, abortTimeout) => {
            const pending = this._reconnectionPromises.get(params.deviceId);
            if (pending) {
              try {
                await pending.promise;
              } catch {
                this._logger.error("Reconnection failed");
              }
            }

            const machine = this._connectionMachines.get(params.deviceId);
            if (!machine) {
              return Left(
                new UnknownDeviceError(`Unknown device ${params.deviceId}`),
              );
            }

            const res = await machine.sendApdu(
              apdu,
              triggersDisconnection,
              abortTimeout,
            );
            return res.chainLeft((err) => {
              if (
                err instanceof DeviceDisconnectedWhileSendingError &&
                triggersDisconnection
              ) {
                return Right({
                  statusCode: new Uint8Array([0x90, 0x00]),
                  data: new Uint8Array(0),
                });
              }
              return Left(err);
            });
          },
        }),
      );
    } catch (e) {
      this._deviceRegistry.delete(params.deviceId);
      this._logger.error("Connection error", { data: { error: e } });
      return Left(new OpeningConnectionError(e));
    }
  }

  private handleDisconnect(
    deviceId: string,
    apduSender: WebBleApduSender,
  ): (ev?: Event) => void {
    return () => {
      const machine = this._connectionMachines.get(deviceId);
      const entry = this._deviceRegistry.get(deviceId);
      if (!machine || !entry) return;
      if (this._reconnectionPromises.has(deviceId)) {
        this._logger.debug("reconnection already in flight, ignoring");
        return;
      }

      const pending = {} as { promise: Promise<void>; resolve: () => void };
      pending.promise = new Promise<void>((res) => (pending.resolve = res));
      this._reconnectionPromises.set(deviceId, pending);

      machine.eventDeviceDisconnected();

      if (this._reconnectionTimers.has(deviceId))
        clearTimeout(this._reconnectionTimers.get(deviceId)!);

      const disconnectTimer = setTimeout(() => {
        entry.onDisconnect?.();
        this._cleanupConnection(deviceId);
      }, RECONNECT_DEVICE_TIMEOUT);
      this._reconnectionTimers.set(deviceId, disconnectTimer);

      const reconnectionSubject = defer(() => {
        this._logger.debug("attempt gatt.connect()");
        if (entry.device.gatt?.connected) entry.device.gatt.disconnect();
        return from(entry.device.gatt!.connect());
      }).pipe(
        timeout({
          first: SINGLE_RECONNECTION_TIMEOUT,
          with: () =>
            throwError(
              () =>
                new OpeningConnectionError(
                  `connect timed out after ${SINGLE_RECONNECTION_TIMEOUT} ms`,
                ),
            ),
        }),
        concatMap(async () => {
          try {
            return await entry.device.gatt!.getPrimaryService(
              entry.service.uuid,
            );
          } catch {
            for (const uuid of this._deviceModelDataSource.getBluetoothServices()) {
              try {
                return await entry.device.gatt!.getPrimaryService(uuid);
              } catch {
                this._logger.warn(
                  `Service ${uuid} not found on device ${entry.device.name}`,
                );
              }
            }
            throw new OpeningConnectionError(
              "Ledger GATT service not found on reconnect",
            );
          }
        }),
        concatMap((svc) =>
          from(this._rebindCharacteristics(deviceId, svc, apduSender, machine)),
        ),
        retryWhen((err$) =>
          err$.pipe(
            tap((err) =>
              this._logger.warn(
                `retrying #${deviceId} (${
                  err instanceof Error ? err.message : err
                })`,
              ),
            ),
            scan((count) => {
              if (count + 1 >= RECONNECTION_RETRY_COUNT) {
                throw new Error("max retries reached");
              }
              return count + 1;
            }, 0),
          ),
        ),
      );

      const reconnectionSub = reconnectionSubject.subscribe({
        next: async () => {
          this._logger.debug(`reconnect SUCCESS for ${deviceId}`);

          const t = this._reconnectionTimers.get(deviceId);
          if (t) {
            clearTimeout(t);
            this._reconnectionTimers.delete(deviceId);
          }

          this._connectionMachines.get(deviceId)?.eventDeviceConnected();

          try {
            if (entry?.onReconnect) {
              await entry.onReconnect(); // wait for SCP reset
            }
          } catch (e) {
            this._logger.error("onReconnect callback threw", {
              data: { error: e },
            });
          }

          // Unblock pending sends *after* SCP reset
          const pendingSenders = this._reconnectionPromises.get(deviceId);
          pendingSenders?.resolve();
          this._reconnectionPromises.delete(deviceId);

          reconnectionSub.unsubscribe();
        },
        error: () => {
          const t = this._reconnectionTimers.get(deviceId);
          if (t) {
            clearTimeout(t);
            this._reconnectionTimers.delete(deviceId);
          }
          this._cleanupDevice(deviceId);
          reconnectionSub.unsubscribe();
        },
      });
    };
  }

  private _cleanupDevice(deviceId: string): void {
    try {
      const machine = this._connectionMachines.get(deviceId);
      const entry = this._deviceRegistry.get(deviceId);
      const pending = this._reconnectionPromises.get(deviceId);

      if (machine) {
        try {
          machine.eventDeviceDisconnected();
          machine.closeConnection();
        } catch (e) {
          this._logger.error("Error closing state machine", {
            data: { error: e },
          });
        }
      }

      if (entry) {
        if (entry.listener) {
          entry.device.removeEventListener(
            "gattserverdisconnected",
            entry.listener,
          );
        }
        if (entry.device.gatt?.connected) {
          entry.device.gatt.disconnect();
        }
      }

      this._connectionMachines.delete(deviceId);
      this._deviceRegistry.delete(deviceId);

      if (pending) {
        pending.resolve();
        this._reconnectionPromises.delete(deviceId);
      }

      if (this._reconnectionTimers.has(deviceId)) {
        clearTimeout(this._reconnectionTimers.get(deviceId)!);
        this._reconnectionTimers.delete(deviceId);
      }
    } catch (e) {
      this._logger.error("Unexpected error during device cleanup", {
        data: { error: e },
      });
    }
  }

  private _cleanupConnection(deviceId: string): void {
    const machine = this._connectionMachines.get(deviceId);
    if (machine) {
      try {
        machine.closeConnection();
      } catch (e) {
        this._logger.error("Error closing state machine", {
          data: { error: e },
        });
      }
      this._connectionMachines.delete(deviceId);
    }

    const pending = this._reconnectionPromises.get(deviceId);
    if (pending) {
      pending.resolve();
      this._reconnectionPromises.delete(deviceId);
    }

    if (this._reconnectionTimers.has(deviceId)) {
      clearTimeout(this._reconnectionTimers.get(deviceId)!);
      this._reconnectionTimers.delete(deviceId);
    }
  }

  private async _rebindCharacteristics(
    deviceId: string,
    freshSvc: BluetoothRemoteGATTService,
    apduSender: WebBleApduSender,
    connectionMachine: DeviceConnectionStateMachine<WebBleApduSenderDependencies>,
  ) {
    const deviceEntry = this._deviceRegistry.get(deviceId)!;

    if (deviceEntry.listener)
      deviceEntry.device.removeEventListener(
        "gattserverdisconnected",
        deviceEntry.listener,
      );

    deviceEntry.listener = this.handleDisconnect(deviceId, apduSender);
    deviceEntry.device.addEventListener(
      "gattserverdisconnected",
      deviceEntry.listener,
    );

    deviceEntry.service = freshSvc;

    await apduSender.setDependencies({
      writeCharacteristic: await freshSvc.getCharacteristic(
        deviceEntry.infos.writeCmdUuid,
      ),
      notifyCharacteristic: await freshSvc.getCharacteristic(
        deviceEntry.infos.notifyUuid,
      ),
    });

    await connectionMachine.setupConnection();
  }

  public async disconnect(params: {
    connectedDevice: TransportConnectedDevice;
  }) {
    const id = params.connectedDevice.id;
    const connectionMachine = this._connectionMachines.get(id);
    if (!connectionMachine)
      return Left(new UnknownDeviceError(`Unknown device ${id}`));

    const entry = this._deviceRegistry.get(id);

    if (entry && entry.onDisconnect) {
      try {
        entry.onDisconnect();
      } catch (e) {
        this._logger.error("Error in onDisconnect callback", {
          data: { error: e },
        });
      }
    }

    this._cleanupDevice(id);
    return Promise.resolve(Right(undefined));
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
