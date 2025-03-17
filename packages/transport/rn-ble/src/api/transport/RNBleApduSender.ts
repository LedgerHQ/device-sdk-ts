import {
  type BleManager,
  type Characteristic,
  type Device,
  type Subscription as RNBleSubscription,
} from "react-native-ble-plx";
import {
  type ApduReceiverService,
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderService,
  type ApduSenderServiceFactory,
  type BleDeviceInfos,
  type DeviceApduSender,
  type DeviceId,
  DeviceNotInitializedError,
  type DmkError,
  type LoggerPublisherService,
  type TransportDiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { Base64 } from "js-base64";
import { type Either, Left, Maybe, Nothing, Right } from "purify-ts";
import { BehaviorSubject } from "rxjs";

const FRAME_HEADER_SIZE = 3;

export type RNBleInternalDevice = {
  id: DeviceId;
  bleDeviceInfos: BleDeviceInfos;
  discoveredDevice: TransportDiscoveredDevice;
  disconnectionSubscription: RNBleSubscription;
  lastDiscoveredTimeStamp: Maybe<number>;
};

type RNBleApduSenderConstructorArgs = {
  dependencies: RNBleApduSenderDependencies;
  apduSenderFactory: ApduSenderServiceFactory;
  apduReceiverFactory: ApduReceiverServiceFactory;
};

export type RNBleApduSenderDependencies = {
  device: Device;
  internalDevice: RNBleInternalDevice;
  manager: BleManager;
};

export class RNBleApduSender
  implements DeviceApduSender<RNBleApduSenderDependencies>
{
  private _dependencies: RNBleApduSenderDependencies;
  private _isDeviceReady: BehaviorSubject<boolean>;
  private _logger: LoggerPublisherService;
  private _apduSender: Maybe<ApduSenderService>;
  private readonly _apduSenderFactory: ApduSenderServiceFactory;
  private readonly _apduReceiver: ApduReceiverService;
  private _sendApduPromiseResolver: Maybe<
    (value: Either<DmkError, ApduResponse>) => void
  >;

  constructor(
    {
      apduSenderFactory,
      apduReceiverFactory,
      dependencies,
    }: RNBleApduSenderConstructorArgs,
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._dependencies = dependencies;
    this._isDeviceReady = new BehaviorSubject<boolean>(false);
    this._logger = loggerServiceFactory("RNBleApduSender");
    this._apduSenderFactory = apduSenderFactory;
    this._apduSender = Nothing;
    this._apduReceiver = apduReceiverFactory();
    this._sendApduPromiseResolver = Nothing;
  }

  private onReceiveSetupApduResponse(value: Uint8Array) {
    const mtuResponse = new Uint8Array(value);
    const { device } = this._dependencies;
    // ledger mtu is the 5th byte of the response
    const [ledgerMtu] = mtuResponse.slice(5);
    let frameSize = device.mtu - FRAME_HEADER_SIZE;

    if (ledgerMtu && ledgerMtu !== frameSize) {
      // should never happen since ble mtu is negotiated on device connect with 156 bytes and ledger should return mtu size minus header size
      frameSize = ledgerMtu;
    }
    this._apduSender = Maybe.of(this._apduSenderFactory({ frameSize }));
    this._isDeviceReady.next(true);
  }

  private receiveApdu(apdu: Uint8Array) {
    const response = this._apduReceiver.handleFrame(apdu);

    response
      .map((maybeApduResponse) => {
        maybeApduResponse.map((apduResponse) => {
          this._logger.debug("Received APDU Response", {
            data: { response: apduResponse },
          });
          this._sendApduPromiseResolver.map((resolve) =>
            resolve(Right(apduResponse)),
          );
        });
      })
      .mapLeft((error) => {
        this._sendApduPromiseResolver.map((resolve) => resolve(Left(error)));
      });
  }

  private onMonitor(characteristic: Characteristic) {
    if (!characteristic.value) {
      return;
    }

    const apdu = Base64.toUint8Array(characteristic.value);
    if (!this._isDeviceReady.value) {
      this.onReceiveSetupApduResponse(apdu);
    } else {
      this.receiveApdu(apdu);
    }
  }

  private write(value: string) {
    return this._dependencies.manager.writeCharacteristicWithoutResponseForDevice(
      this._dependencies.device.id,
      this._dependencies.internalDevice.bleDeviceInfos.serviceUuid,
      this._dependencies.internalDevice.bleDeviceInfos.writeCmdUuid,
      value,
    );
  }

  public getDependencies() {
    return this._dependencies;
  }

  public setDependencies(dependencies: RNBleApduSenderDependencies) {
    this._dependencies = dependencies;
  }

  public async setupConnection() {
    this._dependencies.manager.monitorCharacteristicForDevice(
      this._dependencies.device.id,
      this._dependencies.internalDevice.bleDeviceInfos.serviceUuid,
      this._dependencies.internalDevice.bleDeviceInfos.notifyUuid,
      (error, characteristic) => {
        if (!error && characteristic) {
          this.onMonitor(characteristic);
        }
      },
    );
    this._isDeviceReady.next(false);
    const requestMtuFrame = Uint8Array.from([0x08, 0x00, 0x00, 0x00, 0x00]);
    await this.write(Base64.fromUint8Array(requestMtuFrame));
    await new Promise<void>((resolve) => {
      const sub = this._isDeviceReady.subscribe((isReady) => {
        if (isReady) {
          resolve();
          sub.unsubscribe();
        }
      });
    });
  }

  async sendApdu(apdu: Uint8Array): Promise<Either<DmkError, ApduResponse>> {
    if (!this._isDeviceReady.value) {
      return Promise.resolve(
        Left(new DeviceNotInitializedError("Unknown MTU")),
      );
    }

    const resultPromise = new Promise<Either<DmkError, ApduResponse>>(
      (resolve) => {
        this._sendApduPromiseResolver = Maybe.of(resolve);
      },
    );

    const frames = this._apduSender.caseOf({
      Just: (apduSender) => apduSender.getFrames(apdu),
      Nothing: () => [],
    });

    for (const frame of frames) {
      try {
        await this.write(Base64.fromUint8Array(frame.getRawData()));
      } catch (error) {
        this._logger.info("Error sending frame", { data: { error } });
      }
    }

    return resultPromise;
  }

  public closeConnection() {
    this._dependencies.device.cancelConnection();
  }
}
