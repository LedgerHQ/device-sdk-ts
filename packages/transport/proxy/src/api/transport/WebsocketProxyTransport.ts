import {
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
  private readonly ds: WebSocketProxyDataSourceInstance;
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
    this.ds = new WebSocketProxyDataSource(wsUrl);

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
      id: wsUrl,
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
    return from([[this.baseDevice]]);
  }

  startDiscovering(): Observable<TransportDiscoveredDevice> {
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
      await this.ds.ensureOpen();
      this.ds.ws.send("open");
      await this.ds.waitForOpened();

      const conn: TransportConnectedDevice = {
        id: deviceId,
        transport: this.transportIdentifier,
        type: "USB",
        deviceModel: this.baseDevice.deviceModel,
        sendApdu: (bytes) => this.sendApdu(bytes, onDisconnect),
      };
      return Right(conn);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      return Left(new OpeningConnectionError(e));
    }
  }

  async disconnect(): Promise<Either<DmkError, void>> {
    this.logger.debug("disconnect");
    this.ds.close();
    return Promise.resolve(Right(undefined));
  }

  private async sendApdu(
    bytes: Uint8Array,
    onDisconnect: DisconnectHandler,
  ): Promise<Either<DmkError, ApduResponse>> {
    const hex = bufferToHexaString(bytes).substring(2);
    try {
      this.logger.debug(`send APDU => ${hex}`);
      const respHex = await this.ds.postAdpu(hex);
      this.logger.debug(`receive APDU <= ${respHex}`);
      return Right(this.parse(respHex));
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      onDisconnect(this.wsUrl);
      await this.disconnect();
      return Left(new GeneralDmkError(e));
    }
  }

  private parse(hex: string): ApduResponse {
    const status = hex.slice(-4);
    const data = hex.slice(0, -4);
    return {
      statusCode: this.hexToBytes(status),
      data: this.hexToBytes(data),
    };
  }

  private hexToBytes(h: string): Uint8Array {
    if (!h) return new Uint8Array(0);
    return new Uint8Array(h.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  }
}

export const WsProxyTransportFactory =
  (url = "ws://127.0.0.1:5000"): TransportFactory =>
  ({ config, loggerServiceFactory }) =>
    new WsProxyTransport(loggerServiceFactory, config, url);
