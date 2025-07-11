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
  type TransportDeviceModel,
  type TransportDiscoveredDevice,
  type TransportFactory,
  type TransportIdentifier,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { from, type Observable } from "rxjs";

import {
  WebSocketProxyDataSource,
  type WebSocketProxyDataSourceInstance,
} from "@api/data/WebsocketProxyDataSource";

export const speculosProxyWsIdentifier: TransportIdentifier =
  "PROXY_WEBSOCKET_TRANSPORT";

/**
 * WebSocket-based DMK transport
 */
export class WsProxyTransport implements Transport {
  private readonly transportIdentifier = speculosProxyWsIdentifier;
  private readonly logger: LoggerPublisherService;
  private readonly websocketDataSource: WebSocketProxyDataSourceInstance;
  private readonly wsUrl: string;
  private readonly baseDevice: TransportDiscoveredDevice;

  constructor(
    loggerFactory: (tag: string) => LoggerPublisherService,
    _config: DmkConfig,
    wsUrl: string,
  ) {
    this.logger = loggerFactory("ProxyWsTransport");
    this.logger.debug("Starting WebSocket transport");

    this.wsUrl = wsUrl;
    this.websocketDataSource = new WebSocketProxyDataSource(wsUrl);

    // build static device model
    const baseModel: TransportDeviceModel = {
      id: DeviceModelId.NANO_X,
      productName: `Proxy – [unknown]`,
      usbProductId: 0,
      bootloaderUsbProductId: 0,
      usbOnly: false,
      memorySize: 0,
      masks: [],
      blockSize: 64,
      getBlockSize: () => 64,
    };
    this.baseDevice = {
      id: this.wsUrl,
      transport: this.transportIdentifier,
      deviceModel: baseModel,
    };
  }

  isSupported(): boolean {
    return true;
  }

  getIdentifier(): TransportIdentifier {
    return this.transportIdentifier;
  }

  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    // emit one static device
    return from([[this.baseDevice]]);
  }

  startDiscovering(): Observable<TransportDiscoveredDevice> {
    // same as listen but evented
    return from([this.baseDevice]);
  }

  stopDiscovering(): void {
    this.logger.debug("stopDiscovering");
  }

  async connect({
    deviceId,
    onDisconnect,
  }: {
    deviceId: DeviceId;
    onDisconnect: DisconnectHandler;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    this.logger.debug(`connect to ${deviceId}`);
    if (deviceId !== this.wsUrl) {
      return Left(new UnknownDeviceError(`Invalid device ${deviceId}`));
    }
    try {
      // ensure WS open and perform legacy handshake
      await this.websocketDataSource.ensureOpen();
      this.websocketDataSource.ws.send("open");
      await this.websocketDataSource.waitForOpened();

      // fetch app & version via APDU
      const hexAppAndVersion =
        await this.websocketDataSource.postAdpu("B0010000");
      this.logger.debug(`Hex Response: ${hexAppAndVersion}`);
      const apduAppAndVersion = this.parse(hexAppAndVersion);
      const parser = new ApduParser(apduAppAndVersion);
      parser.extract8BitUInt();
      const appName = parser.encodeToString(parser.extractFieldLVEncoded());
      const appVersion = parser.encodeToString(parser.extractFieldLVEncoded());
      this.logger.debug(`App Name: ${appName}, Version: ${appVersion}`);

      // update productName
      const updatedModel: TransportDeviceModel = {
        ...this.baseDevice.deviceModel,
        productName: `Proxy – ${appName} – ${appVersion}`,
        getBlockSize: this.baseDevice.deviceModel.getBlockSize,
      };

      const connection: TransportConnectedDevice = {
        id: deviceId,
        transport: this.transportIdentifier,
        type: "USB",
        deviceModel: updatedModel,
        sendApdu: (apdu) => this.sendApdu(apdu, onDisconnect),
      };
      return Right(connection);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return Left(new OpeningConnectionError(err));
    }
  }

  async disconnect(_params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    this.logger.debug("disconnect");
    this.websocketDataSource.close();
    return Right(undefined);
  }

  private async sendApdu(
    apdu: Uint8Array,
    onDisconnect: DisconnectHandler,
  ): Promise<Either<DmkError, ApduResponse>> {
    const hex = bufferToHexaString(apdu).substring(2);
    try {
      this.logger.debug(`send APDU => ${hex}`);
      const respHex = await this.websocketDataSource.postAdpu(hex);
      this.logger.debug(`receive APDU <= ${respHex}`);
      return Right(this.parse(respHex));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onDisconnect(this.wsUrl);
      await this.disconnect({
        connectedDevice: {
          id: this.wsUrl,
          transport: this.transportIdentifier,
          type: "USB",
          deviceModel: this.baseDevice.deviceModel,
          sendApdu: () => Promise.resolve(Left(new GeneralDmkError(err))),
        },
      });
      return Left(new GeneralDmkError(err));
    }
  }

  private parse(hex: string): ApduResponse {
    const statusHex = hex.slice(-4);
    const dataHex = hex.slice(0, -4);
    return {
      statusCode: this.hexToBytes(statusHex),
      data: this.hexToBytes(dataHex),
    };
  }

  private hexToBytes(hex: string): Uint8Array {
    return new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  }
}

export const WsProxyTransportFactory =
  (url: string = "ws://127.0.0.1:5000"): TransportFactory =>
  ({ config, loggerServiceFactory }) =>
    new WsProxyTransport(loggerServiceFactory, config, url);
