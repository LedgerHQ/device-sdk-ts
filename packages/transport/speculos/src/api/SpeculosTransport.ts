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

import { HttpSpeculosDatasource } from "@internal/datasource/HttpSpeculosDatasource";
import { type SpeculosDatasource } from "@internal/datasource/SpeculosDatasource";

export const speculosIdentifier: TransportIdentifier =
  "SPECULOS_HTTP_TRANSPORT";

export class SpeculosTransport implements Transport {
  private logger: LoggerPublisherService;
  private readonly identifier: TransportIdentifier = speculosIdentifier;
  private readonly _speculosDataSource: SpeculosDatasource;
  private connectedDevice: TransportConnectedDevice | null = null;
  private disconnectInterval: NodeJS.Timeout | null = null;
  private readonly _isE2E: boolean;
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
      blockSize: 32,
      usbOnly: true,
      memorySize: 320 * 1024,
      masks: [0x31100000],
    },
    transport: this.identifier,
  };

  constructor(
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
    _config: DmkConfig,
    speculosUrl: string,
    isE2E?: boolean,
  ) {
    this._isE2E = isE2E ?? false;
    this.logger = loggerServiceFactory("SpeculosTransport");
    this._speculosDataSource = new HttpSpeculosDatasource(speculosUrl); // See how to pass properly speculos config.
  }

  isSupported(): boolean {
    return true;
  }

  getIdentifier(): TransportIdentifier {
    return this.identifier;
  }

  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    return from([[this.speculosDevice]]);
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

    const hexResponse = await this._speculosDataSource.postApdu("B0010000");
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

      this.connectedDevice = connectedDevice;
      if (!this._isE2E) {
        this.listenForDisconnect(params.onDisconnect, params.deviceId);
      }
      return Right(connectedDevice);
    } catch (error) {
      return Left(new OpeningConnectionError(error as Error));
    }
  }

  async disconnect(_params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    this.logger.debug("disconnect");
    this.connectedDevice = null;
    return Promise.resolve(Right(undefined));
  }

  async sendApdu(
    _sessionId: string,
    deviceId: DeviceId,
    onDisconnect: DisconnectHandler,
    apdu: Uint8Array,
  ): Promise<Either<DmkError, ApduResponse>> {
    try {
      const hexApdu = bufferToHexaString(apdu).substring(2);
      const hexResponse: string =
        await this._speculosDataSource.postApdu(hexApdu);
      const apduResponse = this.createApduResponse(hexResponse);
      return Right(apduResponse);
    } catch (error) {
      if (this.connectedDevice) {
        this.logger.debug("disconnecting");
        onDisconnect(deviceId);
        void this.disconnect({
          connectedDevice: this.connectedDevice,
        });

        if (this.disconnectInterval) {
          clearInterval(this.disconnectInterval);
        }
      }
      return Left(new GeneralDmkError(error));
    }
  }

  private createApduResponse(hexApdu: string): ApduResponse {
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

  private listenForDisconnect(
    onDisconnect: DisconnectHandler,
    deviceId: DeviceId,
  ): void {
    this.disconnectInterval = setInterval(async () => {
      const isServerAvailable =
        await this._speculosDataSource.isServerAvailable();

      if (!isServerAvailable) {
        this.logger.info(
          `Speculos server unavailable, disconnecting device ${deviceId}`,
        );
        onDisconnect(deviceId);

        if (this.connectedDevice) {
          await this.disconnect({
            connectedDevice: this.connectedDevice,
          });
        }

        if (this.disconnectInterval) {
          clearInterval(this.disconnectInterval);
        }
      }
    }, 2000);
  }
}

export const speculosTransportFactory: (
  speculosUrl?: string,
  isE2E?: boolean,
) => TransportFactory =
  (speculosUrl = "http://127.0.0.1:5000", isE2E = false) =>
  ({ config, loggerServiceFactory }) =>
    new SpeculosTransport(loggerServiceFactory, config, speculosUrl, isE2E);
