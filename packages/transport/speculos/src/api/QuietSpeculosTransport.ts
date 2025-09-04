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

import { HttpLegacySpeculosDatasource } from "@internal/datasource/HttpLegacySpeculosDatasource";

import { speculosIdentifier } from "./SpeculosTransport";

export class QuietSpeculosTransport implements Transport {
  private logger: LoggerPublisherService;
  private readonly identifier: TransportIdentifier = speculosIdentifier;
  private readonly _speculosDataSource: HttpLegacySpeculosDatasource;

  private connectedDevice: TransportConnectedDevice | null = null;

  private readonly speculosDevice: TransportDiscoveredDevice = {
    id: "SpeculosID",
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
  ) {
    this.logger = loggerServiceFactory("QuietSpeculosTransport");
    this._speculosDataSource = new HttpLegacySpeculosDatasource(
      speculosUrl,
      10000,
      "ldmk-transport-speculos",
    );
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
    this.logger.debug("stopDiscovering");
  }

  async connect(params: {
    deviceId: DeviceId;
    onDisconnect: DisconnectHandler;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    this.logger.debug("connect");

    // Probe app name/version via GET_VERSION (B0010000) if possible
    try {
      const hexResponse = await this._speculosDataSource.postAdpu("B0010000");
      this.logger.debug(`Hex Response: ${hexResponse}`);
      const apduResponse = this.createApduResponse(hexResponse);
      const parser = new ApduParser(apduResponse);
      parser.extract8BitUInt();
      const appName = parser.encodeToString(parser.extractFieldLVEncoded());
      const appVersion = parser.encodeToString(parser.extractFieldLVEncoded());
      this.logger.debug(`App Name: ${appName} and version ${appVersion}`);

      this.speculosDevice.deviceModel.productName = `Speculos - ${appName} - ${appVersion}`;
    } catch {
      // ignore if the app doesn't support GET_VERSION
    }

    try {
      const connectedDevice: TransportConnectedDevice = {
        sendApdu: (apdu: Uint8Array) =>
          this.sendApdu(params.deviceId, params.onDisconnect, apdu),
        deviceModel: this.speculosDevice.deviceModel,
        transport: this.identifier,
        id: "SpeculosID",
        type: "USB",
      };

      this.connectedDevice = connectedDevice;
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
    deviceId: DeviceId,
    onDisconnect: DisconnectHandler,
    apdu: Uint8Array,
  ): Promise<Either<DmkError, ApduResponse>> {
    try {
      const hex = bufferToHexaString(apdu).substring(2).toUpperCase();
      this.logger.debug(`[QuietSpeculosTransport] send APDU: ${hex}`);
      const hexResponse = await this._speculosDataSource.postAdpu(hex);
      const resp = this.createApduResponse(hexResponse);
      return Right(resp);
    } catch (error) {
      if (this.connectedDevice) {
        this.logger.debug("disconnecting due to APDU error");
        onDisconnect(deviceId);
        await this.disconnect({ connectedDevice: this.connectedDevice });
      }
      return Left(new GeneralDmkError(error as Error));
    }
  }

  private createApduResponse(hexApdu: string): ApduResponse {
    const sw = hexApdu.slice(-4);
    const payload = hexApdu.slice(0, -4);
    this.logger.debug(`[QuietSpeculosTransport] Status code hex: ${sw}`);
    this.logger.debug(`[QuietSpeculosTransport] data hex: ${payload}`);
    return {
      statusCode: this.fromHexString(sw),
      data: this.fromHexString(payload),
    };
  }

  private fromHexString(hexString: string): Uint8Array {
    if (!hexString) return new Uint8Array(0);
    return new Uint8Array(
      hexString.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
    );
  }
}

export const quietSpeculosTransportFactory: (
  speculosUrl?: string,
) => TransportFactory =
  (speculosUrl = "http://127.0.0.1:5000") =>
  ({ config, loggerServiceFactory }) =>
    new QuietSpeculosTransport(loggerServiceFactory, config, speculosUrl);
