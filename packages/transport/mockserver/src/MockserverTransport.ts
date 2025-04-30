import {
  type ApduResponse,
  type ConnectError,
  type DeviceId,
  type DeviceModelId,
  DisconnectError,
  type DisconnectHandler,
  type DmkConfig,
  type DmkError,
  type LoggerPublisherService,
  NoAccessibleDeviceError,
  OpeningConnectionError,
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
  type Session,
} from "@ledgerhq/device-mockserver-client";
import { type Either, Left, Right } from "purify-ts";
import { from, mergeMap, type Observable } from "rxjs";

export const mockserverIdentifier: TransportIdentifier = "MOCKSERVER";

export class MockTransport implements Transport {
  private logger: LoggerPublisherService;
  private mockClient: MockClient;
  private readonly identifier: TransportIdentifier = mockserverIdentifier;

  constructor(
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
    config: DmkConfig,
  ) {
    this.logger = loggerServiceFactory("MockTransport");
    this.mockClient = new MockClient(config.mockUrl);
  }

  isSupported(): boolean {
    return true;
  }

  getIdentifier(): TransportIdentifier {
    return this.identifier;
  }

  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    return from([]);
  }

  startDiscovering(): Observable<TransportDiscoveredDevice> {
    this.logger.debug("startDiscovering");
    return from(
      this.mockClient.scan().then((devices: Device[]) => {
        return devices.map((device: Device) => ({
          id: device.id,
          deviceModel: {
            id: device.device_type as DeviceModelId,
            productName: device.name,
            usbProductId: 0x10,
            bootloaderUsbProductId: 0x0001,
            getBlockSize() {
              return 32;
            },
            usbOnly: true,
            memorySize: 320 * 1024,
            masks: [0x31100000],
          },
          transport: this.identifier,
        }));
      }),
    ).pipe(mergeMap((device) => device));
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
    const sessionId: string = params.deviceId;
    try {
      const session: Session = await this.mockClient.connect(sessionId);
      const connectedDevice = {
        sendApdu: (apdu) => {
          return this.sendApdu(
            sessionId,
            params.deviceId,
            params.onDisconnect,
            apdu,
          );
        },
        deviceModel: {
          id: session.device.device_type,
          productName: session.device.name,
          usbProductId: 0x10,
          legacyUsbProductId: 0x0001,
          bootloaderUsbProductId: 0x10,
          getBlockSize() {
            return 32;
          },
          usbOnly: true,
          memorySize: 320 * 1024,
          masks: [0x31100000],
        },
        id: params.deviceId,
        type: session.device.connectivity_type,
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
    const sessionId: string = params.connectedDevice.id;
    try {
      const success: boolean = await this.mockClient.disconnect(sessionId);
      if (!success) {
        return Left(
          new DisconnectError(new Error(`Failed to disconnect ${sessionId}`)),
        );
      }
      return Right(undefined);
    } catch (error) {
      return Left(new DisconnectError(error as Error));
    }
  }

  async sendApdu(
    sessionId: string,
    deviceId: DeviceId,
    onDisconnect: DisconnectHandler,
    apdu: Uint8Array,
  ): Promise<Either<DmkError, ApduResponse>> {
    this.logger.debug("send");
    try {
      const response: CommandResponse = await this.mockClient.send(
        sessionId,
        apdu,
      );
      return Right({
        statusCode: this.mockClient.fromHexString(
          response.response.substring(
            response.response.length - 4,
            response.response.length,
          ),
        ),
        data: this.mockClient.fromHexString(
          response.response.substring(0, response.response.length - 4),
        ),
      } as ApduResponse);
    } catch (error) {
      onDisconnect(deviceId);
      return Left(new NoAccessibleDeviceError(error as Error));
    }
  }
}

export const mockserverTransportFactory: TransportFactory = ({
  config,
  loggerServiceFactory,
}) => new MockTransport(loggerServiceFactory, config);
