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
  formatApduReceivedLog,
  formatApduSentLog,
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

const DEVICE_BLOCK_SIZE = 32;
const MEMORY_SIZE_KB = 320;
const BYTES_PER_KB = 1024;
const DEVICE_MASK = 0x31100000;
const HEX_PREFIX_LENGTH = 2;
const STATUS_CODE_HEX_LENGTH = 4;
const DISCONNECT_CHECK_INTERVAL_MS = 2000;

export const speculosIdentifier: TransportIdentifier =
  "SPECULOS_HTTP_TRANSPORT";

export class SpeculosTransport implements Transport {
  private logger: LoggerPublisherService;
  private readonly identifier: TransportIdentifier = speculosIdentifier;
  private readonly _speculosDataSource: SpeculosDatasource;
  private connectedDevice: TransportConnectedDevice | null = null;
  private disconnectInterval: NodeJS.Timeout | null = null;
  private readonly _isE2E: boolean;
  private readonly speculosDevice: TransportDiscoveredDevice;

  constructor(
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
    _config: DmkConfig,
    speculosUrl: string,
    isE2E?: boolean,
    deviceModelId: DeviceModelId = DeviceModelId.STAX,
  ) {
    this._isE2E = isE2E ?? false;
    this.logger = loggerServiceFactory("SpeculosTransport");
    this._speculosDataSource = new HttpSpeculosDatasource(speculosUrl);
    this.speculosDevice = {
      id: "SpeculosID",
      deviceModel: {
        id: deviceModelId,
        productName: "Speculos - App Name - version",
        usbProductId: 0x10,
        bootloaderUsbProductId: 0x0001,
        getBlockSize() {
          return DEVICE_BLOCK_SIZE;
        },
        usbOnly: true,
        memorySize: MEMORY_SIZE_KB * BYTES_PER_KB,
        masks: [DEVICE_MASK],
      },
      transport: this.identifier,
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
            return DEVICE_BLOCK_SIZE;
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
      const hexApdu = bufferToHexaString(apdu).substring(HEX_PREFIX_LENGTH);
      const hexResponse: string =
        await this._speculosDataSource.postApdu(hexApdu);
      this.logger.debug(formatApduSentLog(apdu));
      const apduResponse = this.createApduResponse(hexResponse);
      this.logger.debug(formatApduReceivedLog(apduResponse));
      return Right(apduResponse);
    } catch (error) {
      if (this.connectedDevice) {
        this.logger.debug("disconnecting");
        onDisconnect(deviceId);
        this.disconnect({
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
        hexApdu.substring(
          hexApdu.length - STATUS_CODE_HEX_LENGTH,
          hexApdu.length,
        ),
      ),
      data: this.fromHexString(
        hexApdu.substring(0, hexApdu.length - STATUS_CODE_HEX_LENGTH),
      ),
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
    }, DISCONNECT_CHECK_INTERVAL_MS);
  }
}

export const speculosTransportFactory: (
  speculosUrl?: string,
  isE2E?: boolean,
  deviceModelId?: DeviceModelId,
) => TransportFactory =
  (speculosUrl = "http://127.0.0.1:5000", isE2E = false, deviceModelId?) =>
  ({ config, loggerServiceFactory }) =>
    new SpeculosTransport(
      loggerServiceFactory,
      config,
      speculosUrl,
      isE2E,
      deviceModelId,
    );
