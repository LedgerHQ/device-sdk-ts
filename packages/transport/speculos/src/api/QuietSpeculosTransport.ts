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
  private disconnectInterval: NodeJS.Timeout | null = null;

  private cachedB001?: string;
  private isB001(hex: string) {
    return hex.length >= 4 && hex.toUpperCase().startsWith("B001");
  }

  private readonly speculosDevice: TransportDiscoveredDevice = {
    id: "SpeculosID",
    deviceModel: {
      id: DeviceModelId.STAX,
      productName: "Speculos (DMK quiet)",
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

    this.cachedB001 = undefined;

    const sessionId: string = params.deviceId;
    try {
      const connectedDevice: TransportConnectedDevice = {
        sendApdu: (apdu: Uint8Array) =>
          this.sendApdu(sessionId, params.deviceId, params.onDisconnect, apdu),
        deviceModel: {
          ...this.speculosDevice.deviceModel,
          productName: this.speculosDevice.deviceModel.productName,
          getBlockSize() {
            return 32;
          },
        },
        transport: this.identifier,
        id: "SpeculosID",
        type: "USB",
      };

      this.connectedDevice = connectedDevice;
      return Promise.resolve(Right(connectedDevice));
    } catch (error) {
      return Promise.resolve(Left(new OpeningConnectionError(error as Error)));
    }
  }

  async disconnect(_params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    this.logger.debug("disconnect");
    this.connectedDevice = null;
    if (this.disconnectInterval) clearInterval(this.disconnectInterval);
    this.cachedB001 = undefined;
    return Promise.resolve(Right(undefined));
  }

  async sendApdu(
    _sid: string,
    deviceId: DeviceId,
    onDisconnect: DisconnectHandler,
    apdu: Uint8Array,
  ) {
    try {
      const hex = bufferToHexaString(apdu).substring(2).toUpperCase();

      // Swallow duplicate B001s (only return the first real response)
      if (this.isB001(hex)) {
        if (!this.cachedB001) {
          this.logger.debug(
            "[QuietSpeculosTransport] send APDU (first B001): B0010000",
          );
          this.cachedB001 = await this._speculosDataSource.postAdpu("B0010000");
        } else {
          this.logger.debug(
            "[QuietSpeculosTransport] respond with cached B001",
          );
        }
        return Right(this.createApduResponse(this.cachedB001));
      }

      this.logger.debug(`[QuietSpeculosTransport] send APDU: ${hex}`);
      const hexResponse = await this._speculosDataSource.postAdpu(hex);
      return Right(this.createApduResponse(hexResponse));
    } catch (e) {
      if (this.connectedDevice) {
        this.logger.debug("disconnecting due to APDU error");
        onDisconnect(deviceId);
        await this.disconnect({ connectedDevice: this.connectedDevice });
      }
      return Left(new GeneralDmkError(e as Error));
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
    if (!hexString) return Uint8Array.from([]);
    return new Uint8Array(
      hexString.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
    );
  }
}

export const quietSpeculosTransportFactory: (
  speculosUrl?: string,
  legacyE2ECompatibility?: boolean,
) => TransportFactory =
  (speculosUrl = "http://127.0.0.1:5000") =>
  ({ config, loggerServiceFactory }) =>
    new QuietSpeculosTransport(loggerServiceFactory, config, speculosUrl);
