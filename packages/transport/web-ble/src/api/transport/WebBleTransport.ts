import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  type ConnectError,
  DeviceAlreadyConnectedError,
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

import {
  ADVERTISING_DELAY,
  ADVERTISING_TIMEOUT,
  RECONNECT_DEVICE_TIMEOUT,
  RECONNECTION_LOOP_BACKOFF,
  REDISCOVER_TIMEOUT,
} from "@api/data/WebBleConfig";

import {
  WebBleApduSender,
  type WebBleApduSenderDependencies,
} from "./WebBleApduSender";

export const webBleIdentifier: TransportIdentifier = "WEB-BLE-RN-STYLE";

type DeviceRegistryEntry = {
  device: BluetoothDevice;
  serviceUuid?: string;
  ledgerServiceInfo?: {
    writeCmdUuid: string;
    writeUuid?: string;
    notifyUuid: string;
    deviceModel: TransportDeviceModel;
  };
  discoveredDevice: TransportDiscoveredDevice;
  gattDisconnectListener?: (ev: Event) => void;
};

export class WebBleTransport implements Transport {
  private _logger: LoggerPublisherService;

  private _connectionStateMachinesByDeviceId = new Map<
    string,
    DeviceConnectionStateMachine<WebBleApduSenderDependencies>
  >();
  private _deviceRegistryById = new Map<string, DeviceRegistryEntry>();
  private _discoveredDevices$ = new BehaviorSubject<
    TransportDiscoveredDevice[]
  >([]);

  constructor(
    private readonly _deviceModelDataSource: DeviceModelDataSource,
    private loggerFactory: (tag: string) => LoggerPublisherService,
    private readonly _apduSenderFactory: ApduSenderServiceFactory,
    private readonly _apduReceiverFactory: ApduReceiverServiceFactory,
  ) {
    this._logger = loggerFactory("WebBleTransportRnStyle");
  }

  isSupported(): boolean {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
  }

  getIdentifier(): TransportIdentifier {
    return webBleIdentifier;
  }

  startDiscovering(): Observable<TransportDiscoveredDevice> {
    const bluetoothServiceUuids = this._deviceModelDataSource
      .getBluetoothServices()
      .map((serviceUuid) => ({ services: [serviceUuid] }));
    const allOptionalServiceUuids =
      this._deviceModelDataSource.getBluetoothServices();

    return from(
      navigator.bluetooth.requestDevice({
        filters: bluetoothServiceUuids,
        optionalServices: allOptionalServiceUuids,
      }),
    ).pipe(
      switchMap(async (bluetoothDevice) => {
        const { serviceUuid, ledgerServiceInfo } =
          await this._identifyLedgerGattService(bluetoothDevice);

        const discoveredDevice: TransportDiscoveredDevice = {
          id: bluetoothDevice.id,
          deviceModel: ledgerServiceInfo.deviceModel,
          transport: webBleIdentifier,
          name: bluetoothDevice.name || undefined,
        };

        this._deviceRegistryById.set(bluetoothDevice.id, {
          device: bluetoothDevice,
          serviceUuid,
          ledgerServiceInfo,
          discoveredDevice,
        });

        this._publishDiscoveredDevices();
        return discoveredDevice;
      }),
    );
  }

  stopDiscovering(): void {
    /* no-op on Web Bluetooth */
  }

  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    this._publishDiscoveredDevices();
    return this._discoveredDevices$.asObservable();
  }

  async connect(params: {
    deviceId: string;
    onDisconnect: (deviceId: string) => void;
    onReconnect?: (deviceId: string) => Promise<void> | void;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    const registryEntry = this._deviceRegistryById.get(params.deviceId);
    if (!registryEntry)
      return Left(new UnknownDeviceError(`Unknown device ${params.deviceId}`));

    if (this._connectionStateMachinesByDeviceId.has(params.deviceId)) {
      return Left(
        new DeviceAlreadyConnectedError(
          `Device ${params.deviceId} already connected`,
        ),
      );
    }

    try {
      const bluetoothDevice = registryEntry.device;
      if (!bluetoothDevice.gatt) {
        throw new OpeningConnectionError("No GATT server available on device");
      }

      if (!bluetoothDevice.gatt.connected) {
        await this._withTimeout(
          bluetoothDevice.gatt.connect(),
          6000,
          "GATT connect timed out",
        );
        await this._sleep(150);
      }

      const { service: ledgerService, ledgerServiceInfo } =
        await this._getPrimaryLedgerGattService(bluetoothDevice);
      const {
        writeCharacteristic: gattWriteCharacteristic,
        notifyCharacteristic: gattNotifyCharacteristic,
      } = await this._resolveLedgerServiceCharacteristics(
        ledgerService,
        ledgerServiceInfo,
      );

      const apduSender = new WebBleApduSender(
        {
          writeCharacteristic: gattWriteCharacteristic,
          notifyCharacteristic: gattNotifyCharacteristic,
          apduSenderFactory: this._apduSenderFactory,
          apduReceiverFactory: this._apduReceiverFactory,
        },
        this.loggerFactory,
      );

      const connectionStateMachine =
        new DeviceConnectionStateMachine<WebBleApduSenderDependencies>({
          deviceId: params.deviceId,
          deviceApduSender: apduSender,
          timeoutDuration: RECONNECT_DEVICE_TIMEOUT,
          tryToReconnect: () => {
            this._tryToReconnect(params.deviceId, params.onReconnect).catch(
              (e) =>
                this._logger.error("tryToReconnect() threw", { data: { e } }),
            );
          },
          onTerminated: () => {
            try {
              this._connectionStateMachinesByDeviceId
                .get(params.deviceId)
                ?.closeConnection();
              params.onDisconnect(params.deviceId);
            } finally {
              this._connectionStateMachinesByDeviceId.delete(params.deviceId);
              const entry = this._deviceRegistryById.get(params.deviceId);
              if (entry?.gattDisconnectListener) {
                entry.device.removeEventListener(
                  "gattserverdisconnected",
                  entry.gattDisconnectListener,
                );
                entry.gattDisconnectListener = undefined;
              }
              this._publishDiscoveredDevices();
            }
          },
        });

      await apduSender.setupConnection();

      this._connectionStateMachinesByDeviceId.set(
        params.deviceId,
        connectionStateMachine,
      );
      registryEntry.serviceUuid = ledgerService.uuid;
      registryEntry.ledgerServiceInfo = ledgerServiceInfo;

      const onGattDisconnected = (_ev: Event) =>
        this._handleGattServerDisconnected(params.deviceId);
      registryEntry.gattDisconnectListener = onGattDisconnected;
      bluetoothDevice.addEventListener(
        "gattserverdisconnected",
        onGattDisconnected,
      );

      this._publishDiscoveredDevices();

      return Right(
        new TransportConnectedDevice({
          id: params.deviceId,
          deviceModel: ledgerServiceInfo.deviceModel,
          type: "BLE",
          transport: webBleIdentifier,
          sendApdu: (...apduArgs) =>
            connectionStateMachine.sendApdu(...apduArgs),
          name: bluetoothDevice.name || undefined,
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
    const deviceId = params.connectedDevice.id;
    const connectionStateMachine =
      this._connectionStateMachinesByDeviceId.get(deviceId);
    const registryEntry = this._deviceRegistryById.get(deviceId);
    if (!connectionStateMachine)
      return Left(new UnknownDeviceError(`Unknown device ${deviceId}`));

    try {
      connectionStateMachine.closeConnection();
      this._connectionStateMachinesByDeviceId.delete(deviceId);
      if (registryEntry?.gattDisconnectListener) {
        registryEntry.device.removeEventListener(
          "gattserverdisconnected",
          registryEntry.gattDisconnectListener,
        );
        registryEntry.gattDisconnectListener = undefined;
      }
      await this._safelyCancelGattConnection(deviceId);
      this._publishDiscoveredDevices();
      return Right(undefined);
    } catch (e) {
      return Left(new GeneralDmkError({ originalError: e }));
    }
  }

  private _handleGattServerDisconnected(deviceId: string) {
    this._logger.debug(`[${deviceId}] gattserverdisconnected`);
    const connectionStateMachine =
      this._connectionStateMachinesByDeviceId.get(deviceId);
    if (!connectionStateMachine) return;
    connectionStateMachine.eventDeviceDisconnected();
  }

  private async _waitForAdvertisementInRange(
    device: BluetoothDevice,
    opts: { startTimeoutMs?: number; advTimeoutMs?: number } = {},
  ): Promise<boolean> {
    const { startTimeoutMs = 500, advTimeoutMs = 1500 } = opts;
    if (typeof device.watchAdvertisements !== "function") return false;

    const abortController = new AbortController();
    const startTimer = setTimeout(
      () => abortController.abort(),
      startTimeoutMs,
    );
    const advertisementsStarted = await device
      .watchAdvertisements({ signal: abortController.signal })
      .then(() => true)
      .catch(() => false);
    clearTimeout(startTimer);
    if (!advertisementsStarted) return false;

    const advertisementSeen = await new Promise<boolean>((resolve) => {
      const handleAdvertisement = () => {
        device.removeEventListener(
          "advertisementreceived",
          handleAdvertisement,
        );
        resolve(true);
      };
      device.addEventListener("advertisementreceived", handleAdvertisement);
      setTimeout(() => {
        device.removeEventListener(
          "advertisementreceived",
          handleAdvertisement,
        );
        resolve(false);
      }, advTimeoutMs);
    });

    abortController.abort();
    return advertisementSeen;
  }

  private async _rediscoverPermittedDevice(
    targetDeviceId: string,
  ): Promise<BluetoothDevice | null> {
    if (typeof navigator.bluetooth.getDevices !== "function") return null;
    try {
      this._logger.debug(`Attempting to rediscover device ${targetDeviceId}`);
      const permittedDevices = await navigator.bluetooth.getDevices();
      const matchingDevice =
        permittedDevices.find((d) => d.id === targetDeviceId) ?? null;

      if (matchingDevice) {
        const isInRange = await this._waitForAdvertisementInRange(
          matchingDevice,
          {
            startTimeoutMs: ADVERTISING_DELAY,
            advTimeoutMs: ADVERTISING_TIMEOUT,
          },
        );
        this._logger.debug(
          `Rediscovered ${matchingDevice.id}, inRange=${isInRange}`,
        );
      }
      return matchingDevice;
    } catch {
      return null;
    }
  }

  private async _tryToReconnect(
    deviceId: string,
    onReconnect?: (id: string) => Promise<void> | void,
  ) {
    await this._safelyCancelGattConnection(deviceId);

    while (true) {
      const registryEntry = this._deviceRegistryById.get(deviceId);
      const connectionStateMachine =
        this._connectionStateMachinesByDeviceId.get(deviceId);

      if (!registryEntry || !connectionStateMachine) {
        this._logger.debug(
          `[${deviceId}] aborting reconnect: registry or state machine missing`,
        );
        return;
      }

      try {
        const rediscoveredDevice = await this._withTimeout(
          this._rediscoverPermittedDevice(deviceId),
          REDISCOVER_TIMEOUT,
          "rediscovery timeout",
        );

        if (!rediscoveredDevice) throw new Error("Device not found");

        if (!rediscoveredDevice.gatt) throw new Error("No GATT on device");

        try {
          await rediscoveredDevice.gatt.connect();
        } catch (e) {
          this._logger.error(`[${deviceId}] gatt.connect() failed`, {
            data: { e },
          });
          if (rediscoveredDevice.gatt.connected)
            rediscoveredDevice.gatt.disconnect();
        }

        const { service: ledgerService, ledgerServiceInfo } =
          await this._getPrimaryLedgerGattService(rediscoveredDevice);

        const {
          writeCharacteristic: gattWriteCharacteristic,
          notifyCharacteristic: gattNotifyCharacteristic,
        } = await this._resolveLedgerServiceCharacteristics(
          ledgerService,
          ledgerServiceInfo,
        );

        connectionStateMachine.setDependencies({
          writeCharacteristic: gattWriteCharacteristic,
          notifyCharacteristic: gattNotifyCharacteristic,
        });
        await connectionStateMachine.setupConnection();
        connectionStateMachine.eventDeviceConnected();

        registryEntry.serviceUuid = ledgerService.uuid;
        registryEntry.ledgerServiceInfo = ledgerServiceInfo;

        if (registryEntry.gattDisconnectListener) {
          rediscoveredDevice.removeEventListener(
            "gattserverdisconnected",
            registryEntry.gattDisconnectListener,
          );
        }

        const onDisconnectedCallback = (_: Event) =>
          this._handleGattServerDisconnected(deviceId);

        rediscoveredDevice.addEventListener(
          "gattserverdisconnected",
          onDisconnectedCallback,
        );

        registryEntry.gattDisconnectListener = onDisconnectedCallback;

        await onReconnect?.(deviceId);

        this._publishDiscoveredDevices();

        return;
      } catch (e) {
        this._logger.error(`[${deviceId}] reconnect attempt failed`, {
          data: { e },
        });

        if (registryEntry?.device.gatt?.connected)
          registryEntry.device.gatt.disconnect();

        await this._sleep(RECONNECTION_LOOP_BACKOFF);
        continue;
      }
    }
  }

  private async _safelyCancelGattConnection(deviceId: string) {
    const registryEntry = this._deviceRegistryById.get(deviceId);
    if (!registryEntry) return;
    if (registryEntry.device.gatt?.connected)
      registryEntry.device.gatt.disconnect();
    await this._sleep(100);
  }

  private async _identifyLedgerGattService(device: BluetoothDevice): Promise<{
    serviceUuid: string;
    ledgerServiceInfo: NonNullable<DeviceRegistryEntry["ledgerServiceInfo"]>;
  }> {
    if (!device.gatt) {
      throw new OpeningConnectionError("No GATT server available on device");
    }
    try {
      await this._withTimeout(device.gatt.connect(), 6000, "connect timeout");
      const { service, ledgerServiceInfo } =
        await this._getPrimaryLedgerGattService(device);
      return { serviceUuid: service.uuid, ledgerServiceInfo };
    } finally {
      device.gatt?.disconnect();
      await this._sleep(200);
    }
  }

  private async _getPrimaryLedgerGattService(device: BluetoothDevice): Promise<{
    service: BluetoothRemoteGATTService;
    ledgerServiceInfo: NonNullable<DeviceRegistryEntry["ledgerServiceInfo"]>;
  }> {
    const knownLedgerServiceUuids =
      this._deviceModelDataSource.getBluetoothServices();
    const lastSuccessfulServiceUuid = this._deviceRegistryById.get(
      device.id,
    )?.serviceUuid;
    const preferredSearchOrder = lastSuccessfulServiceUuid
      ? [
          lastSuccessfulServiceUuid,
          ...knownLedgerServiceUuids.filter(
            (u) => u !== lastSuccessfulServiceUuid,
          ),
        ]
      : knownLedgerServiceUuids.slice();

    for (const candidateUuid of preferredSearchOrder) {
      try {
        const primaryService =
          await device.gatt!.getPrimaryService(candidateUuid);
        const ledgerServiceInfoMap =
          this._deviceModelDataSource.getBluetoothServicesInfos();
        const ledgerServiceInfo = ledgerServiceInfoMap[primaryService.uuid];
        if (!ledgerServiceInfo) throw new UnknownDeviceError(device.name || "");
        return { service: primaryService, ledgerServiceInfo };
      } catch (e: unknown) {
        if ((e as Error)?.name === "SecurityError") {
          throw new OpeningConnectionError(
            `Missing Web Bluetooth permission for service ${candidateUuid}. ` +
              `Add it to optionalServices in requestDevice().`,
          );
        }
        try {
          const allPrimaryServices = await device.gatt!.getPrimaryServices();
          const matchedService = allPrimaryServices.find(
            (s) => s.uuid.toLowerCase() === candidateUuid.toLowerCase(),
          );
          if (matchedService) {
            const ledgerServiceInfoMap =
              this._deviceModelDataSource.getBluetoothServicesInfos();
            const ledgerServiceInfo = ledgerServiceInfoMap[matchedService.uuid];
            if (!ledgerServiceInfo)
              throw new UnknownDeviceError(device.name || "");
            return { service: matchedService, ledgerServiceInfo };
          }
        } catch {
          this._logger.error("Failed to get primary services", {
            data: { deviceId: device.id },
          });
        }
      }
    }
    throw new OpeningConnectionError("Ledger GATT service not found");
  }

  private async _resolveLedgerServiceCharacteristics(
    service: BluetoothRemoteGATTService,
    ledgerServiceInfo: NonNullable<DeviceRegistryEntry["ledgerServiceInfo"]>,
  ): Promise<{
    writeCharacteristic: BluetoothRemoteGATTCharacteristic;
    notifyCharacteristic: BluetoothRemoteGATTCharacteristic;
  }> {
    const notifyCharacteristic = await service.getCharacteristic(
      ledgerServiceInfo.notifyUuid,
    );
    const writeCharacteristic = await this._findWritableCharacteristic(
      service,
      ledgerServiceInfo,
    );
    return { writeCharacteristic, notifyCharacteristic };
  }

  private async _findWritableCharacteristic(
    service: BluetoothRemoteGATTService,
    ledgerServiceInfo: NonNullable<DeviceRegistryEntry["ledgerServiceInfo"]>,
  ): Promise<BluetoothRemoteGATTCharacteristic> {
    const preferredCharacteristicUuids = [
      ledgerServiceInfo.writeCmdUuid,
      ledgerServiceInfo.writeUuid,
    ].filter(Boolean) as string[];

    const attemptedCharacteristics: BluetoothRemoteGATTCharacteristic[] = [];

    for (const uuid of preferredCharacteristicUuids) {
      try {
        const characteristic = await service.getCharacteristic(uuid);
        attemptedCharacteristics.push(characteristic);

        if (characteristic.properties.writeWithoutResponse)
          return characteristic;
        if (characteristic.properties.write) return characteristic;
      } catch {
        this._logger.error("Failed to get write characteristic", {
          data: { deviceId: service.device.id },
        });
      }
    }

    throw new OpeningConnectionError("No write characteristic available");
  }

  private _publishDiscoveredDevices() {
    const connectedSummaries: TransportDiscoveredDevice[] = [];
    for (const [deviceId] of this._connectionStateMachinesByDeviceId) {
      const registryEntry = this._deviceRegistryById.get(deviceId);
      if (registryEntry?.ledgerServiceInfo) {
        connectedSummaries.push({
          id: deviceId,
          deviceModel: registryEntry.ledgerServiceInfo.deviceModel,
          transport: webBleIdentifier,
          name: registryEntry.device.name || undefined,
        });
      }
    }
    const scannedSummaries = Array.from(this._deviceRegistryById.values())
      .map((entry) => entry.discoveredDevice)
      .filter(
        (summary) => !this._connectionStateMachinesByDeviceId.has(summary.id),
      );

    this._discoveredDevices$.next([...connectedSummaries, ...scannedSummaries]);
  }

  private _withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
    onTimeoutCancel?: () => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new OpeningConnectionError(timeoutMessage));
        onTimeoutCancel?.();
      }, timeoutMs);
      promise.then(
        (value) => {
          clearTimeout(timeoutHandle);
          resolve(value);
        },
        (error) => {
          this._logger.error("withTimeout() promise rejected", {
            data: { e: error },
          });
          clearTimeout(timeoutHandle);
          reject(error);
        },
      );
    });
  }

  private _sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
