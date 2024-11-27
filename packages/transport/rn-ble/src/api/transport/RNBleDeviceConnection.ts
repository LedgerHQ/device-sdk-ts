import { type Characteristic, type Subscription } from "react-native-ble-plx";
import {
  type ApduReceiverService,
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderService,
  type ApduSenderServiceFactory,
  type DeviceConnection,
  DeviceNotInitializedError,
  type DmkError,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Base64 } from "js-base64";
import { type Either, Left, Maybe, Nothing, Right } from "purify-ts";

type RNBleDeviceConnectionConstructorArgs = {
  writeCharacteristic: Characteristic;
  notifyCharacteristic: Characteristic;
  apduSenderFactory: ApduSenderServiceFactory;
  apduReceiverFactory: ApduReceiverServiceFactory;
};

export class RNBleDeviceConnection implements DeviceConnection {
  private _writeCharacteristic: Characteristic;
  private _notifyCharacteristic: Characteristic;
  private _isDeviceReady: boolean;
  private _logger: LoggerPublisherService;
  private _apduSender: Maybe<ApduSenderService>;
  private readonly _apduSenderFactory: ApduSenderServiceFactory;
  private readonly _apduReceiver: ApduReceiverService;
  private _sendApduPromiseResolver: Maybe<
    (value: Either<DmkError, ApduResponse>) => void
  >;
  private _monitorSubscription: Subscription;

  constructor(
    {
      writeCharacteristic,
      notifyCharacteristic,
      apduSenderFactory,
      apduReceiverFactory,
    }: RNBleDeviceConnectionConstructorArgs,
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._writeCharacteristic = writeCharacteristic;
    this._notifyCharacteristic = notifyCharacteristic;
    this._isDeviceReady = false;
    this._logger = loggerServiceFactory("RNBleDeviceConnection");
    this._monitorSubscription = this._notifyCharacteristic.monitor(
      (error, response) => {
        if (response && !error) {
          this.onMonitor(response);
        }
      },
    );
    this._apduSenderFactory = apduSenderFactory;
    this._apduSender = Nothing;
    this._apduReceiver = apduReceiverFactory();
    this._sendApduPromiseResolver = Nothing;
  }

  private onReceiveSetupApduResponse(value: Uint8Array) {
    const mtuResponse = new Uint8Array(value);
    // the mtu is the 5th byte of the response
    const [frameSize] = mtuResponse.slice(5);
    if (frameSize) {
      this._apduSender = Maybe.of(this._apduSenderFactory({ frameSize }));
      this._isDeviceReady = true;
    }
  }

  private receiveApdu(apdu: Uint8Array) {
    const response = this._apduReceiver.handleFrame(apdu);

    response.map((maybeApduResponse) => {
      maybeApduResponse.map((apduResponse) => {
        this._logger.debug("Received APDU Response", {
          data: { response: apduResponse },
        });
        this._sendApduPromiseResolver.map((resolve) =>
          resolve(Right(apduResponse)),
        );
      });
    });
  }

  private onMonitor(characteristic: Characteristic) {
    if (!characteristic.value) {
      return;
    }
    const apdu = Base64.toUint8Array(characteristic.value);
    if (!this._isDeviceReady) {
      this.onReceiveSetupApduResponse(apdu);
    } else {
      this.receiveApdu(apdu);
    }
  }

  public async setup() {
    const requestMtuApdu = Uint8Array.from([0x08, 0x00, 0x00, 0x00, 0x00]);

    await this._writeCharacteristic.writeWithoutResponse(
      Base64.fromUint8Array(requestMtuApdu),
    );
  }

  async sendApdu(
    apdu: Uint8Array,
    _triggersDisconnection?: boolean,
  ): Promise<Either<DmkError, ApduResponse>> {
    if (!this._isDeviceReady) {
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
        await this._writeCharacteristic.writeWithoutResponse(
          Base64.fromUint8Array(frame.getRawData()),
        );
      } catch (error) {
        this._logger.error("Error sending frame", { data: { error } });
      }
    }
    const response = await resultPromise;
    this._sendApduPromiseResolver = Maybe.zero();
    return response.caseOf({
      Right: (apduResponse) => {
        return Promise.resolve(Right(apduResponse));
      },
      Left: async (error) => Promise.resolve(Left(error)),
    });
  }

  public async reconnect(
    writeCharacteristic: Characteristic,
    notifyCharacteristic: Characteristic,
  ) {
    this._writeCharacteristic = writeCharacteristic;
    this._notifyCharacteristic = notifyCharacteristic;
    await this.setup();
  }

  public disconnect() {
    this._monitorSubscription.remove();
  }
}
