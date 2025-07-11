import {
  ApduParser,
  type ApduResponse,
  bufferToHexaString,
  type ConnectError,
  type DeviceId,
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
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import {
  BehaviorSubject,
  from,
  interval,
  type Observable,
  of,
  Subject,
  type Subscription,
} from "rxjs";
import { catchError, filter, map, mergeMap } from "rxjs/operators";

import {
  HttpProxyDataSource,
  type HttpProxyDataSourceInstance,
} from "@api/data/HttpProxyDataSource";
import { type DescriptorEvent, diffAndEmit } from "@api/utils/diffAndEmit";

export const speculosProxyHttpIdentifier: TransportIdentifier =
  "PROXY_HTTP_TRANSPORT";

/**
 * HTTP-based DMK transport
 */
export class HttpProxyTransport implements Transport {
  private readonly transportIdentifier: TransportIdentifier =
    speculosProxyHttpIdentifier;
  private readonly logger: LoggerPublisherService;
  private readonly httpDataSource: HttpProxyDataSourceInstance;
  private readonly discoveredDevicesSubject = new BehaviorSubject<
    TransportDiscoveredDevice[]
  >([]);
  private readonly deviceEventsSubject = new Subject<
    DescriptorEvent<TransportDiscoveredDevice>
  >();
  private readonly seenDevices = new Map<string, TransportDiscoveredDevice>();
  private discoverySubscription?: Subscription;
  private activeDeviceConnection: TransportConnectedDevice | null = null;

  constructor(
    loggerFactory: (tag: string) => LoggerPublisherService,
    _config: DmkConfig,
    private readonly baseUrl: string,
  ) {
    this.httpDataSource = new HttpProxyDataSource(baseUrl);
    this.logger = loggerFactory("ProxyHttpTransport");
    this.logger.debug("Starting HTTP proxy transport");
  }

  isSupported(): boolean {
    return true;
  }
  getIdentifier(): TransportIdentifier {
    return this.transportIdentifier;
  }

  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    return this.discoveredDevicesSubject.asObservable();
  }

  startDiscovering(): Observable<TransportDiscoveredDevice> {
    this.logger.debug("startDiscovering — polling HTTP /devices every 5s");

    this.discoverySubscription = interval(5_000)
      .pipe(
        mergeMap(() =>
          from(this.fetchDevices()).pipe(
            // catches any fetch error and recover by returning an empty array
            catchError((err) => {
              this.logger.debug("fetchDevices failed, retrying…", err);
              return of<TransportDiscoveredDevice[]>([]);
            }),
          ),
        ),
      )
      .subscribe((rawDeviceList) => {
        const prefixedDevices = rawDeviceList.map((device) => ({
          ...device,
          id: `${this.baseUrl}#${device.id}`,
        }));
        diffAndEmit(prefixedDevices, this.seenDevices, (event) =>
          this.deviceEventsSubject.next(event),
        );
        this.discoveredDevicesSubject.next(
          Array.from(this.seenDevices.values()),
        );
      });

    // initial fetch
    from(this.fetchDevices())
      .pipe(
        catchError((err) => {
          this.logger.debug("initial fetch failed, continuing…", err);
          return of<TransportDiscoveredDevice[]>([]);
        }),
      )
      .subscribe((rawDeviceList) => {
        const prefixedDevices = rawDeviceList.map((device) => ({
          ...device,
          id: `${this.baseUrl}#${device.id}`,
        }));
        diffAndEmit(prefixedDevices, this.seenDevices, (event) =>
          this.deviceEventsSubject.next(event),
        );
        this.discoveredDevicesSubject.next(
          Array.from(this.seenDevices.values()),
        );
      });

    // only emit additions to callers
    return this.deviceEventsSubject.pipe(
      filter((evt) => evt.type === "add"),
      map((evt) => evt.descriptor as TransportDiscoveredDevice),
    );
  }

  stopDiscovering(): void {
    this.logger.debug("stopDiscovering");
    this.discoverySubscription?.unsubscribe();
    this.discoverySubscription = undefined;
  }

  async connect({
    deviceId,
    onDisconnect,
  }: {
    deviceId: DeviceId;
    onDisconnect: DisconnectHandler;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    this.logger.debug(`connect to ${deviceId}`);
    const [urlPrefix] = deviceId.split("#");
    if (urlPrefix !== this.baseUrl) {
      return Left(new UnknownDeviceError(`Invalid device ${deviceId}`));
    }
    const deviceInfo = this.seenDevices.get(deviceId);
    if (!deviceInfo) {
      return Left(new UnknownDeviceError(`Unknown device ${deviceId}`));
    }
    try {
      const hexAppAndVersion = await this.httpDataSource.postAdpu("B0010000");
      this.logger.debug(`Hex Response: ${hexAppAndVersion}`);
      const apduAppAndVersion = this.parse(hexAppAndVersion);
      const parserAppAndVersion = new ApduParser(apduAppAndVersion);
      parserAppAndVersion.extract8BitUInt();
      const appName = parserAppAndVersion.encodeToString(
        parserAppAndVersion.extractFieldLVEncoded(),
      );
      const appVersion = parserAppAndVersion.encodeToString(
        parserAppAndVersion.extractFieldLVEncoded(),
      );
      this.logger.debug(`App Name: ${appName}, Version: ${appVersion}`);

      const connection: TransportConnectedDevice = {
        id: deviceId,
        transport: this.transportIdentifier,
        type: "USB",
        deviceModel: {
          ...deviceInfo.deviceModel,
          productName: `Proxy – ${appName} – ${appVersion}`,
          getBlockSize: () => deviceInfo.deviceModel.blockSize,
        },
        sendApdu: (bytes) => this.sendApdu(bytes, onDisconnect),
      };
      this.activeDeviceConnection = connection;
      return Right(connection);
    } catch (error) {
      return Left(new OpeningConnectionError(error));
    }
  }

  async disconnect(_params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    this.logger.debug("disconnect");
    this.httpDataSource.close();
    this.activeDeviceConnection = null;
    return Promise.resolve(Right(undefined));
  }

  private async sendApdu(
    bytes: Uint8Array,
    onDisconnect: DisconnectHandler,
  ): Promise<Either<DmkError, ApduResponse>> {
    const hex = bufferToHexaString(bytes).substring(2);
    try {
      this.logger.debug(`send APDU => ${hex}`);
      const responseHex = await this.httpDataSource.postAdpu(hex);
      this.logger.debug(`receive APDU <= ${responseHex}`);
      return Right(this.parse(responseHex));
    } catch (err) {
      this.logger.debug("APDU failed, disconnecting");
      if (this.activeDeviceConnection) {
        onDisconnect(this.activeDeviceConnection.id);
        await this.disconnect({ connectedDevice: this.activeDeviceConnection });
      }
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
    const match = hex.match(/.{1,2}/g);
    return match
      ? new Uint8Array(match.map((b) => parseInt(b, 16)))
      : new Uint8Array();
  }

  private async fetchDevices(): Promise<TransportDiscoveredDevice[]> {
    const response = await fetch(`${this.baseUrl}/devices`);
    return (await response.json()) as TransportDiscoveredDevice[];
  }
}

export const HttpProxyTransportFactory =
  (url: string = "http://127.0.0.1:5000"): TransportFactory =>
  ({ config, loggerServiceFactory }) =>
    new HttpProxyTransport(loggerServiceFactory, config, url);
