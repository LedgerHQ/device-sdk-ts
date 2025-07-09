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

import { HttpProxyDataSource } from "@api/data/HttpProxyDataSource";
import { type ProxyDataSource } from "@api/data/ProxyDataSource";

export const speculosIdentifier: TransportIdentifier =
  "SPECULOS_HTTP_TRANSPORT";

export class HttpProxyTransport implements Transport {
  private readonly identifier: TransportIdentifier = speculosIdentifier;
  private readonly proxyDataSource: ProxyDataSource;
  private readonly logger: LoggerPublisherService;
  private connectedDevice: TransportConnectedDevice | null = null;
  private readonly speculosDevice: TransportDiscoveredDevice;

  constructor(
    loggerFactory: (tag: string) => LoggerPublisherService,
    _config: DmkConfig,
    url: string,
  ) {
    this.logger = loggerFactory("HttpProxyTransport");
    this.proxyDataSource = new HttpProxyDataSource(url);
    const generatedId = `Speculos-${Date.now()}-${Math.floor(
      Math.random() * 1e6,
    )}`;
    this.speculosDevice = {
      id: generatedId,
      transport: this.identifier,
      deviceModel: {
        id: DeviceModelId.STAX,
        productName: `Speculos (${generatedId})`,
        usbProductId: 0x10,
        bootloaderUsbProductId: 0x0001,
        getBlockSize: () => 32,
        blockSize: 32,
        usbOnly: true,
        memorySize: 320 * 1024,
        masks: [0x31100000],
      },
    };
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
    try {
      const hexResponse = await this.proxyDataSource.postAdpu("B0010000");
      const apduRes = this.parseResponse(hexResponse);
      const parser = new ApduParser(apduRes);
      const appName = parser.encodeToString(parser.extractFieldLVEncoded());
      const appVersion = parser.encodeToString(parser.extractFieldLVEncoded());

      const sessionId = params.deviceId;
      const connectedDevice: TransportConnectedDevice = {
        id: this.speculosDevice.id,
        transport: this.identifier,
        deviceModel: {
          ...this.speculosDevice.deviceModel,
          productName: `Speculos - ${appName} - ${appVersion}`,
          getBlockSize: () => 32,
        },
        type: "USB",
        sendApdu: (apdu) =>
          this.sendApdu(sessionId, params.deviceId, params.onDisconnect, apdu),
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
    return Right(undefined);
  }

  async sendApdu(
    _sessionId: string,
    deviceId: DeviceId,
    onDisconnect: DisconnectHandler,
    apdu: Uint8Array,
  ): Promise<Either<DmkError, ApduResponse>> {
    const hex = bufferToHexaString(apdu).substring(2);
    this.logger.debug(`sendApdu => ${hex}`);
    try {
      const hexResponse = await this.proxyDataSource.postAdpu(hex);
      const apduRes = this.parseResponse(hexResponse);
      return Right(apduRes);
    } catch (error) {
      if (this.connectedDevice) {
        onDisconnect(deviceId);
        await this.disconnect({
          connectedDevice: this.connectedDevice,
        });
      }
      return Left(new GeneralDmkError(error as Error));
    }
  }

  private parseResponse(hexData: string): ApduResponse {
    const statusHex = hexData.slice(-4);
    const dataHex = hexData.slice(0, -4);
    return {
      statusCode: this.hexToBytes(statusHex),
      data: this.hexToBytes(dataHex),
    };
  }

  private hexToBytes(hex: string): Uint8Array {
    if (!hex) return new Uint8Array();
    return new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  }
}

export const speculosTransportFactory: (
  speculosUrl?: string,
) => TransportFactory =
  (speculosUrl = "http://127.0.0.1:5000") =>
  ({ config, loggerServiceFactory }) =>
    new HttpProxyTransport(loggerServiceFactory, config, speculosUrl);
