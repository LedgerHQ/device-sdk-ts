/* istanbul ignore file */
// pragma to ignore this file from coverage
import {
  CommandResponse,
  Device,
  MockClient,
  Session,
} from "@ledgerhq/device-sdk-transport-mock";
import { Either, Left, Right } from "purify-ts";
import { from, mergeMap, Observable } from "rxjs";

import { DeviceId, DeviceModelId } from "@api/device/DeviceModel";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { SdkError } from "@api/Error";
import { Transport } from "@api/transport/model/Transport";
import { TransportIdentifier } from "@api/transport/model/TransportIdentifier";
import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { DisconnectHandler } from "@internal/transport/model/DeviceConnection";
import {
  ConnectError,
  DisconnectError,
  NoAccessibleDeviceError,
  OpeningConnectionError,
} from "@internal/transport/model/Errors";
import { InternalConnectedDevice } from "@internal/transport/model/InternalConnectedDevice";
import { InternalDiscoveredDevice } from "@internal/transport/model/InternalDiscoveredDevice";

export class MockTransport implements Transport {
  static readonly identifier: TransportIdentifier = "MOCK_SERVER";
  private _logger!: LoggerPublisherService;
  private mockClient: MockClient;

  constructor(mockUrl: string) {
    this.mockClient = new MockClient(mockUrl);
  }

  setLogger(_logger: LoggerPublisherService): void {
    this._logger = _logger;
  }
  setDeviceModelDataSource(
    _deviceModelDataSource: DeviceModelDataSource,
  ): void {
    this._logger.debug("Mock service doesn't need a device model data source.");
  }
  setDeviceConnectionFactory(_deviceConnectionFactory: unknown): void {
    this._logger.debug(
      "Mock service doesn't need a device connection factory.",
    );
  }

  setupDependencies(): void {
    throw new Error("Method not implemented.");
  }

  isSupported(): boolean {
    return true;
  }

  getIdentifier(): TransportIdentifier {
    return MockTransport.identifier;
  }

  listenToKnownDevices(): Observable<InternalDiscoveredDevice[]> {
    return from([]);
  }

  startDiscovering(): Observable<InternalDiscoveredDevice> {
    this._logger.debug("startDiscovering");
    return from(
      this.mockClient.scan().then((devices: Device[]) => {
        return devices.map((device: Device) => {
          return {
            id: device.id,
            deviceModel: {
              id: device.device_type as DeviceModelId,
              productName: device.name,
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
            transport: MockTransport.identifier,
          };
        });
      }),
    ).pipe(mergeMap((device) => device));
  }

  stopDiscovering(): void {
    //DO NOTHING HERE
    this._logger.debug("stopDiscovering");
  }

  async connect(params: {
    deviceId: DeviceId;
    onDisconnect: DisconnectHandler;
  }): Promise<Either<ConnectError, InternalConnectedDevice>> {
    this._logger.debug("connect");
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
        transport: MockTransport.identifier,
      } as InternalConnectedDevice;
      return Right(connectedDevice);
    } catch (error) {
      return Left(new OpeningConnectionError(error as Error));
    }
  }

  async disconnect(params: {
    connectedDevice: InternalConnectedDevice;
  }): Promise<Either<SdkError, void>> {
    this._logger.debug("disconnect");
    const sessionId: string = params.connectedDevice.id;
    try {
      const success: boolean = await this.mockClient.disconnect(sessionId);
      if (!success) {
        return Left(
          new DisconnectError(new Error(`Failed to disconnect ${sessionId}`)),
        );
      }
      return Right(void 0);
    } catch (error) {
      return Left(new DisconnectError(error as Error));
    }
  }

  async sendApdu(
    sessionId: string,
    deviceId: DeviceId,
    onDisconnect: DisconnectHandler,
    apdu: Uint8Array,
  ): Promise<Either<SdkError, ApduResponse>> {
    this._logger.debug("send");
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
