/* istanbul ignore file */
// pragma to ignore this file from coverage
import {
  CommandResponse,
  Device,
  MockClient,
  Session,
} from "@ledgerhq/device-transport-kit-mock-client";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";
import { from, mergeMap, Observable } from "rxjs";

import { DeviceId, DeviceModelId } from "@api/device/DeviceModel";
import { ApduResponse } from "@api/device-session/ApduResponse";
import type { DmkConfig } from "@api/DmkConfig";
import { DmkError } from "@api/Error";
import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DisconnectHandler } from "@api/transport/model/DeviceConnection";
import {
  ConnectError,
  DisconnectError,
  NoAccessibleDeviceError,
  OpeningConnectionError,
} from "@api/transport/model/Errors";
import { Transport } from "@api/transport/model/Transport";
import { TransportConnectedDevice } from "@api/transport/model/TransportConnectedDevice";
import { TransportDiscoveredDevice } from "@api/transport/model/TransportDiscoveredDevice";
import {
  BuiltinTransports,
  TransportIdentifier,
} from "@api/transport/model/TransportIdentifier";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";

@injectable()
export class MockTransport implements Transport {
  private logger: LoggerPublisherService;
  private mockClient: MockClient;
  private readonly identifier: TransportIdentifier =
    BuiltinTransports.MOCK_SERVER;

  constructor(
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
    @inject(transportDiTypes.DmkConfig) config: DmkConfig,
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

  listenToKnownDevices(): Observable<TransportDiscoveredDevice[]> {
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
