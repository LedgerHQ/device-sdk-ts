import { MockClient } from "@ledgerhq/device-sdk-transport-mock";
import { CommandResponse } from "@ledgerhq/device-sdk-transport-mock/src/model/CommandResponse";
import { Device } from "@ledgerhq/device-sdk-transport-mock/src/model/Device";
import { Session } from "@ledgerhq/device-sdk-transport-mock/src/model/Session";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";
import { from, mergeMap, Observable } from "rxjs";

import { DeviceId } from "@api/device/DeviceModel";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { SdkError } from "@api/Error";
import { Transport } from "@api/transport/model/Transport";
import {
  BuiltinTransports,
  TransportIdentifier,
} from "@api/transport/model/TransportIdentifier";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
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

@injectable()
export class MockTransport implements Transport {
  private logger: LoggerPublisherService;
  private mockClient: MockClient;
  private readonly identifier: TransportIdentifier =
    BuiltinTransports.MOCK_SERVER;

  constructor(
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerServiceFactory("MockTransport");
    this.mockClient = new MockClient("http://127.0.0.1:8080/");
  }

  isSupported(): boolean {
    return true;
  }

  getIdentifier(): TransportIdentifier {
    return this.identifier;
  }

  startDiscovering(): Observable<InternalDiscoveredDevice> {
    this.logger.debug("startDiscovering");
    return from(
      this.mockClient.scan().then((devices: Device[]) => {
        return devices.map((device: Device) => {
          return {
            id: device.id,
            deviceModel: {
              id: device.device_type,
              productName: device.name,
              usbProductId: 0x10,
              legacyUsbProductId: 0x0001,
              usbOnly: true,
              memorySize: 320 * 1024,
              masks: [0x31100000],
            },
            transport: this.identifier,
          } as InternalDiscoveredDevice;
        });
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
  }): Promise<Either<ConnectError, InternalConnectedDevice>> {
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
          usbOnly: true,
          memorySize: 320 * 1024,
          masks: [0x31100000],
        },
        id: params.deviceId,
        type: session.device.connectivity_type,
        transport: this.identifier,
      } as InternalConnectedDevice;
      return Right(connectedDevice);
    } catch (error) {
      return Left(new OpeningConnectionError(error as Error));
    }
  }

  async disconnect(params: {
    connectedDevice: InternalConnectedDevice;
  }): Promise<Either<SdkError, void>> {
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
  ): Promise<Either<SdkError, ApduResponse>> {
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
