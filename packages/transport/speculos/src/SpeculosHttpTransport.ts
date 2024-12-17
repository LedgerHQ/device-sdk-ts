import {
  type ApduResponse,
  bufferToHexaString,
  type ConnectError,
  type DeviceId,
  DeviceModel,
  DeviceModelId,
  DisconnectError,
  type DisconnectHandler,
  DiscoveredDevice,
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

import { type Either, Left, Right } from "purify-ts";
import { from, mergeMap, type Observable } from "rxjs";
import { HttpSpeculosDatasource } from "./datasource/HttpSpeculosDatasource";
import { SpeculosDatasource } from "./datasource/SpeculosDatasource";

export const mockserverIdentifier: TransportIdentifier =
  "SPECULOS_HTTP_TRANSPORT";

export class SpeculosHttpTransport implements Transport {
  private logger: LoggerPublisherService;
  private readonly identifier: TransportIdentifier = mockserverIdentifier;
  private readonly _speculosDataSource: SpeculosDatasource;
  private readonly speculosDevice: TransportDiscoveredDevice = {
    id: "SpeculosID", //TODO make it dynamic at creation
    deviceModel: {
      id: DeviceModelId.STAX,
      productName: "Speculos - App Name - version",
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
  };

  constructor(
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
    private readonly config: DmkConfig,
  ) {
    this.logger = loggerServiceFactory("SpeculosTransport");
    this._speculosDataSource = new HttpSpeculosDatasource(
      "https://localhost:5001/",
    ); // See how to pass properly speculos config.
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
    return from([this.speculosDevice]);
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
      const connectedDevice = {
        sendApdu: (apdu) => {
          return this.sendApdu(
            sessionId,
            params.deviceId,
            params.onDisconnect,
            apdu,
          );
        },
        deviceModel: this.speculosDevice.deviceModel,
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
    return Right(void 0);
  }

  async sendApdu(
    sessionId: string,
    deviceId: DeviceId,
    onDisconnect: DisconnectHandler,
    apdu: Uint8Array,
  ): Promise<Either<DmkError, ApduResponse>> {
    this.logger.debug("send");
    const hexApdu = bufferToHexaString(apdu);
    const hexResponse: string =
      await this._speculosDataSource.postAdpu(hexApdu);
    return Right({
      statusCode: this.fromHexString(
        hexResponse.substring(hexResponse.length - 4, hexResponse.length),
      ),
      data: this.fromHexString(
        hexResponse.substring(0, hexResponse.length - 4),
      ),
    } as ApduResponse);
  }

  private fromHexString(hexString: string): Uint8Array {
    if (!hexString) {
      return Uint8Array.from([]);
    }
    return new Uint8Array(
      hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
    );
  }
}

export const speculosHtttpTransportFactory: TransportFactory = ({
  config,
  loggerServiceFactory,
}) => new SpeculosHttpTransport(loggerServiceFactory, config);
