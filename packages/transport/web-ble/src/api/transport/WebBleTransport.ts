import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  type ConnectError,
  DeviceAlreadyConnectedError,
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
import { from, type Observable, Subject } from "rxjs";
import { switchMap } from "rxjs/operators";
import { v4 as uuid } from "uuid";

import { RECONNECT_DEVICE_TIMEOUT } from "@api/data/WebBleConfig";

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
  private _retryInFlight = new Map<string, boolean>();

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
        const services = await server.getPrimaryServices();

        if (services.length === 0)
          throw new OpeningConnectionError("No GATT services found");

        const service = services[0];

        if (!service) throw new OpeningConnectionError("No GATT service found");

        const infos =
          this._deviceModelDataSource.getBluetoothServicesInfos()[service.uuid];

        if (!infos) throw new UnknownDeviceError(device.name || "");

        const id = uuid();
        const discovered: TransportDiscoveredDevice = {
          id,
          deviceModel: infos.deviceModel,
          transport: webBleIdentifier,
        };

        this._deviceRegistry.set(id, {
          device,
          service,
          infos,
          discovered,
        });

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
    onDisconnect: () => void;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    const deviceEntry = this._deviceRegistry.get(params.deviceId);

    if (!deviceEntry)
      return Left(new UnknownDeviceError(`Unknown device ${params.deviceId}`));

    if (this._connectionMachines.has(params.deviceId))
      return Left(new DeviceAlreadyConnectedError("Already connected"));

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

      const connectionMachine =
        new DeviceConnectionStateMachine<WebBleApduSenderDependencies>({
          deviceId: params.deviceId,
          deviceApduSender: apduSender,
          timeoutDuration: RECONNECT_DEVICE_TIMEOUT,
          onTerminated: () => {
            this._connectionMachines.delete(params.deviceId);
            this._deviceRegistry.delete(params.deviceId);
            params.onDisconnect();
          },
        });

      await connectionMachine.setupConnection();

      this._connectionMachines.set(params.deviceId, connectionMachine);

      device.ongattserverdisconnected = this.handleDisconnect(
        params.deviceId,
        apduSender,
      );

      return Right(
        new TransportConnectedDevice({
          id: params.deviceId,
          deviceModel: discovered.deviceModel,
          type: "BLE",
          transport: webBleIdentifier,
          sendApdu: async (apdu, triggersDisconnection, abortTimeout) => {
            const deviceId = params.deviceId;
            const machine = this._connectionMachines.get(deviceId);

            if (!machine)
              return Left(new UnknownDeviceError(`Unknown device ${deviceId}`));

            // first shot
            let result = await machine.sendApdu(
              apdu,
              triggersDisconnection,
              abortTimeout,
            );

            // if any error, and we haven't retried yet, do one more pass
            if (result.isLeft() && !this._retryInFlight.get(deviceId)) {
              this._retryInFlight.set(deviceId, true);
              this._logger.info("APDU send failed, retrying one more time…");

              // if there's a reconnection in flight, await, otherwise this is a no-op
              const reconnectInfo = this._reconnectionPromises.get(deviceId);

              if (reconnectInfo) await reconnectInfo.promise;

              // get the freshest state‐machine and replay
              const freshMachine = this._connectionMachines.get(deviceId);

              if (freshMachine) {
                result = await freshMachine.sendApdu(
                  apdu,
                  triggersDisconnection,
                  abortTimeout,
                );
              }

              this._retryInFlight.delete(deviceId);
            }

            return result;
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
  ): () => void {
    return () => {
      const connectionMachine = this._connectionMachines.get(deviceId);
      const deviceEntry = this._deviceRegistry.get(deviceId);

      if (!connectionMachine || !deviceEntry) return;

      // prep a “reconnected” promise
      const reconnectionPromise = {} as {
        promise: Promise<void>;
        resolve: () => void;
      };

      reconnectionPromise.promise = new Promise<void>((resolve) => {
        reconnectionPromise.resolve = resolve;
      });

      this._reconnectionPromises.set(deviceId, reconnectionPromise);

      connectionMachine.eventDeviceDetached();

      const MAX_RETRIES = 5;

      (async () => {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            deviceEntry.device.gatt?.disconnect?.();

            if (!deviceEntry.device.gatt)
              throw new OpeningConnectionError(
                "No GATT server available for reconnection",
              );

            const server = await deviceEntry.device.gatt.connect();
            const services = await server.getPrimaryServices();

            if (services.length === 0) throw new OpeningConnectionError();

            const freshSvc = services[0];

            if (!freshSvc) throw new OpeningConnectionError();

            // rebind
            deviceEntry.device.ongattserverdisconnected = this.handleDisconnect(
              deviceId,
              apduSender,
            );
            deviceEntry.service = freshSvc;

            const newWrite = await freshSvc.getCharacteristic(
              deviceEntry.infos.writeCmdUuid,
            );
            const newNotify = await freshSvc.getCharacteristic(
              deviceEntry.infos.notifyUuid,
            );

            await apduSender.setDependencies({
              writeCharacteristic: newWrite,
              notifyCharacteristic: newNotify,
            });

            // re‐negotiate MTU & restart FSM
            await connectionMachine.setupConnection();

            connectionMachine.eventDeviceAttached();

            // signal “we’re back”
            const reconnectPromise = this._reconnectionPromises.get(deviceId);

            if (reconnectPromise) {
              reconnectPromise.resolve();
              this._reconnectionPromises.delete(deviceId);
            }

            return;
          } catch (_) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }
        this._logger.error(`All reconnection attempts failed for ${deviceId}`);
      })();
    };
  }

  public async disconnect(params: {
    connectedDevice: TransportConnectedDevice;
  }) {
    const id = params.connectedDevice.id;
    const connectionMachine = this._connectionMachines.get(id);

    if (!connectionMachine)
      return Left(new UnknownDeviceError(`Unknown device ${id}`));

    // cancel any pending reconnection
    const reconnectInfo = this._reconnectionPromises.get(id);
    if (reconnectInfo) {
      reconnectInfo.resolve();
      this._reconnectionPromises.delete(id);
    }

    // close and clean up
    connectionMachine.closeConnection();
    this._connectionMachines.delete(id);
    this._deviceRegistry.delete(id);

    return Right(undefined);
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
