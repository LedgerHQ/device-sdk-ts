import {
  type ApduResponse,
  type ConnectError,
  type DeviceId,
  type DeviceModelId,
  DisconnectError,
  type DisconnectHandler,
  type DmkError,
  formatApduReceivedLog,
  formatApduSentLog,
  hexaStringToBuffer,
  type LoggerPublisherService,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  StaticDeviceModelDataSource,
  type Transport,
  type TransportConnectedDevice,
  type TransportDiscoveredDevice,
  type TransportFactory,
  type TransportIdentifier,
} from "@ledgerhq/device-management-kit";
import {
  type CommandResponse,
  type Device,
  MockClient,
} from "@ledgerhq/device-mockserver-client";
import { type Either, Left, Right } from "purify-ts";
import {
  catchError,
  from,
  map,
  mergeMap,
  type Observable,
  of,
  switchMap,
  timer,
} from "rxjs";

export const mockserverIdentifier: TransportIdentifier = "MOCKSERVER";

const DEFAULT_MASKS = [0x31100000];

/**
 * Real per-model memory constants (memory size, block size, masks) so mock
 * devices report the same values as physical ones. Without this, memory-aware
 * device actions (e.g. install/update apps, which run {@link PredictOutOfMemoryTask})
 * compute against wrong constants and wrongly report out-of-memory.
 */
const deviceModelDataSource = new StaticDeviceModelDataSource();

/** Interval (ms) at which the mock server is polled for available devices. */
const DISCOVERY_POLL_INTERVAL_MS = 1000;

export class MockTransport implements Transport {
  private logger: LoggerPublisherService;
  private mockClient: MockClient;
  private readonly identifier: TransportIdentifier = mockserverIdentifier;

  constructor(
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
    mockUrl: string,
    sessionToken?: string,
  ) {
    this.logger = loggerServiceFactory("MockTransport");
    this.mockClient = new MockClient(mockUrl, { token: sessionToken });
  }

  isSupported(): boolean {
    return true;
  }

  getIdentifier(): TransportIdentifier {
    return this.identifier;
  }

  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    this.logger.debug("listenToAvailableDevices");
    return timer(0, DISCOVERY_POLL_INTERVAL_MS).pipe(
      switchMap(() => from(this.mockClient.listDevices())),
      map((devices) => this.mapToDiscoveredDevices(devices)),
      catchError((error) => {
        this.logger.error("listenToAvailableDevices failed", {
          data: { error },
        });
        return of([]);
      }),
    );
  }

  startDiscovering(): Observable<TransportDiscoveredDevice> {
    this.logger.debug("startDiscovering");
    return from(this.mockClient.listDevices()).pipe(
      map((devices) => this.mapToDiscoveredDevices(devices)),
      mergeMap((devices) => from(devices)),
    );
  }

  stopDiscovering(): void {
    //DO NOTHING HERE
    this.logger.debug("stopDiscovering");
  }

  async connect(params: {
    deviceId: DeviceId;
    onDisconnect: DisconnectHandler;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    this.logger.debug("connect");
    const deviceId: string = params.deviceId;
    try {
      const { device } = await this.mockClient.connect(deviceId);
      const connectedDevice = {
        sendApdu: (apdu) =>
          this.sendApdu(deviceId, params.deviceId, params.onDisconnect, apdu),
        deviceModel: this.buildDeviceModel(device),
        id: params.deviceId,
        type: device.connectivity_type,
        transport: this.identifier,
      } as TransportConnectedDevice;
      return Right(connectedDevice);
    } catch (error) {
      return Left(new OpeningConnectionError(error as Error));
    }
  }

  async disconnect(params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    this.logger.debug("disconnect");
    const deviceId: string = params.connectedDevice.id;
    try {
      const success: boolean = await this.mockClient.disconnect(deviceId);
      if (!success) {
        return Left(
          new DisconnectError(new Error(`Failed to disconnect ${deviceId}`)),
        );
      }
      return Right(undefined);
    } catch (error) {
      return Left(new DisconnectError(error as Error));
    }
  }

  async sendApdu(
    deviceId: string,
    onDisconnectDeviceId: DeviceId,
    onDisconnect: DisconnectHandler,
    apdu: Uint8Array,
  ): Promise<Either<DmkError, ApduResponse>> {
    this.logger.debug("send");
    try {
      const response: CommandResponse = await this.mockClient.sendApdu(
        deviceId,
        apdu,
      );
      this.logger.debug(formatApduSentLog(apdu));
      const apduResponse = {
        statusCode:
          hexaStringToBuffer(response.response.slice(-4)) ?? new Uint8Array(),
        data:
          hexaStringToBuffer(response.response.slice(0, -4)) ??
          new Uint8Array(),
      } as ApduResponse;
      this.logger.debug(formatApduReceivedLog(apduResponse));
      return Right(apduResponse);
    } catch (error) {
      onDisconnect(onDisconnectDeviceId);
      return Left(new NoAccessibleDeviceError(error as Error));
    }
  }

  private mapToDiscoveredDevices(
    devices: Device[],
  ): TransportDiscoveredDevice[] {
    return devices.map((device) => ({
      id: device.id,
      deviceModel: this.buildDeviceModel(device),
      transport: this.identifier,
    }));
  }

  private buildDeviceModel(device: Device) {
    const id = device.device_type as DeviceModelId;
    // Resolve the real model to mirror a physical device's memory constants;
    // fall back to legacy defaults for an unknown device type.
    const knownModel = deviceModelDataSource
      .getAllDeviceModels()
      .find((model) => model.id === id);
    return {
      id,
      productName: device.name,
      usbProductId: 0x10,
      legacyUsbProductId: 0x0001,
      bootloaderUsbProductId: 0x0001,
      getBlockSize: knownModel ? knownModel.getBlockSize : () => 32,
      usbOnly: true,
      memorySize: knownModel?.memorySize ?? 320 * 1024,
      masks: device.masks ?? DEFAULT_MASKS,
    };
  }
}

/**
 * Build a mock-server transport factory.
 *
 * @param mockUrl Optional mock server URL. When omitted, `config.mockUrl` from
 *   the DMK configuration is used.
 * @param sessionToken Optional bearer token to share an existing session
 *   When omitted, the client self-provisions a session via /auth.
 */
export const mockserverTransportFactory =
  (mockUrl?: string, sessionToken?: string): TransportFactory =>
  ({ config, loggerServiceFactory }) =>
    new MockTransport(
      loggerServiceFactory,
      mockUrl ?? config.mockUrl,
      sessionToken,
    );
