import {
  ApduParser,
  type ApduResponse,
  bufferToHexaString,
  type ConnectError,
  type DeviceId,
  DeviceModelId,
  type DisconnectHandler,
  type DmkConfig,
  type DmkError,
  GeneralDmkError,
  type LoggerPublisherService,
  OpeningConnectionError,
  type Transport,
  type TransportConnectedDevice,
  type TransportDiscoveredDevice,
  type TransportFactory,
  type TransportIdentifier,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { from, type Observable } from "rxjs";
import { of } from "rxjs";

import { HttpSpeculosDatasource } from "@internal/datasource/HttpSpeculosDatasource";
import { type SpeculosDatasource } from "@internal/datasource/SpeculosDatasource";

export const speculosIdentifier: TransportIdentifier =
  "SPECULOS_HTTP_TRANSPORT";

export class SpeculosTransport implements Transport {
  private logger: LoggerPublisherService;
  private readonly identifier: TransportIdentifier = speculosIdentifier;
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
    _config: DmkConfig,
  ) {
    this.logger = loggerServiceFactory("SpeculosTransport");
    this._speculosDataSource = new HttpSpeculosDatasource(
      "http://localhost:5001",
    ); // See how to pass properly speculos config.
  }
  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    // In Speculos, the device is always available.
    // In a more complex flow, this might poll or merge updates from multiple sources.
    return of([this.speculosDevice]);
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

    const hexResponse = await this._speculosDataSource.postAdpu("B0010000");
    this.logger.debug(`Hex Response: ${hexResponse}`);
    const apduResponse = this.createApduResponse(hexResponse);
    const parser = new ApduParser(apduResponse);

    //Copy paste from GetAppAndVersionCommand
    parser.extract8BitUInt(); //Need otherwise parser is not in the right position
    const appName = parser.encodeToString(parser.extractFieldLVEncoded());
    const appVersion = parser.encodeToString(parser.extractFieldLVEncoded());

    this.logger.debug(`App Name: ${appName} and version ${appVersion}`);

    const sessionId: string = params.deviceId;
    try {
      const connectedDevice: TransportConnectedDevice = {
        sendApdu: (apdu) => {
          return this.sendApdu(
            sessionId,
            params.deviceId,
            params.onDisconnect,
            apdu,
          );
        },
        deviceModel: {
          ...this.speculosDevice.deviceModel,
          productName: `Speculos - ${appName} - ${appVersion}`,
          getBlockSize() {
            return 32;
          },
        },
        transport: this.identifier,
        id: "SpeculosID", //TODO make it dynamic at creation
        type: "USB",
      };
      return Right(connectedDevice);
    } catch (error) {
      return Left(new OpeningConnectionError(error as Error));
    }
  }

  async disconnect(_params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    this.logger.debug("disconnect");
    return Right(void 0);
  }

  async sendApdu(
    _sessionId: string,
    _deviceId: DeviceId,
    _onDisconnect: DisconnectHandler,
    apdu: Uint8Array,
  ): Promise<Either<DmkError, ApduResponse>> {
    try {
      const hexApdu = bufferToHexaString(apdu).substring(2);
      this.logger.debug(`send APDU:  ${hexApdu}`);
      const hexResponse: string =
        await this._speculosDataSource.postAdpu(hexApdu);
      const apduResponse = this.createApduResponse(hexResponse);
      return Right(apduResponse);
    } catch (error) {
      return Left(new GeneralDmkError(error));
    }
  }

  private createApduResponse(hexApdu: string): ApduResponse {
    this.logger.debug(
      `Status code hex: ${hexApdu.substring(hexApdu.length - 4, hexApdu.length)}`,
    );
    this.logger.debug(`data hex: ${hexApdu.substring(0, hexApdu.length - 4)}`);

    const apduResponse = {
      statusCode: this.fromHexString(
        hexApdu.substring(hexApdu.length - 4, hexApdu.length),
      ),
      data: this.fromHexString(hexApdu.substring(0, hexApdu.length - 4)),
    };
    return apduResponse;
  }

  //TODO: Move this to a helper
  private fromHexString(hexString: string): Uint8Array {
    if (!hexString) {
      return Uint8Array.from([]);
    }
    return new Uint8Array(
      hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
    );
  }
}

export const speculosTransportFactory: TransportFactory = ({
  config,
  loggerServiceFactory,
}) => new SpeculosTransport(loggerServiceFactory, config);
