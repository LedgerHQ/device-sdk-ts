import {
  type ApduReceiverService,
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderService,
  type ApduSenderServiceFactory,
  CommandUtils,
  type DeviceConnection,
  DeviceNotInitializedError,
  type DmkError,
  type LoggerPublisherService,
  ReconnectionFailedError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Maybe, Nothing, Right } from "purify-ts";

type BleDeviceConnectionConstructorArgs = {
  writeCharacteristic: BluetoothRemoteGATTCharacteristic;
  notifyCharacteristic: BluetoothRemoteGATTCharacteristic;
  apduSenderFactory: ApduSenderServiceFactory;
  apduReceiverFactory: ApduReceiverServiceFactory;
};

export type DataViewEvent = Event & {
  target: {
    value: DataView;
  };
};

export class BleDeviceConnection implements DeviceConnection {
  private _writeCharacteristic: BluetoothRemoteGATTCharacteristic;
  private _notifyCharacteristic: BluetoothRemoteGATTCharacteristic;
  private readonly _logger: LoggerPublisherService;
  private _apduSender: Maybe<ApduSenderService>;
  private readonly _apduSenderFactory: ApduSenderServiceFactory;
  private readonly _apduReceiver: ApduReceiverService;
  private _isDeviceReady: boolean;
  private _sendApduPromiseResolver: Maybe<{
    resolve(value: Either<DmkError, ApduResponse>): void;
  }>;
  private _settleReconnectionPromiseResolvers: Maybe<{
    resolve(): void;
    reject(err: DmkError): void;
  }>;

  constructor(
    {
      writeCharacteristic,
      notifyCharacteristic,
      apduSenderFactory,
      apduReceiverFactory,
    }: BleDeviceConnectionConstructorArgs,
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._apduSenderFactory = apduSenderFactory;
    this._apduSender = Nothing;
    this._apduReceiver = apduReceiverFactory();
    this._logger = loggerServiceFactory("BleDeviceConnection");
    this._writeCharacteristic = writeCharacteristic;
    this._notifyCharacteristic = notifyCharacteristic;
    this._notifyCharacteristic.oncharacteristicvaluechanged =
      this.onNotifyCharacteristicValueChanged;
    this._isDeviceReady = false;
    this._sendApduPromiseResolver = Maybe.zero();
    this._settleReconnectionPromiseResolvers = Maybe.zero();
  }

  /**
   * NotifyCharacteristic setter
   * Register a listener on characteristic value change
   * @param notifyCharacteristic
   * @private
   */
  private set notifyCharacteristic(
    notifyCharacteristic: BluetoothRemoteGATTCharacteristic,
  ) {
    this._notifyCharacteristic = notifyCharacteristic;
    this._notifyCharacteristic.oncharacteristicvaluechanged =
      this.onNotifyCharacteristicValueChanged;
  }

  /**
   * WriteCharacteristic setter
   * @param writeCharacteristic
   * @private
   */
  private set writeCharacteristic(
    writeCharacteristic: BluetoothRemoteGATTCharacteristic,
  ) {
    this._writeCharacteristic = writeCharacteristic;
  }

  /**
   * Event handler to setup the mtu size in response of 0x0800000000 APDU
   * @param value
   * @private
   */
  private onReceiveSetupApduResponse(value: ArrayBuffer) {
    const mtuResponse = new Uint8Array(value);
    // the mtu is the 5th byte of the response
    const [frameSize] = mtuResponse.slice(5);
    if (frameSize) {
      this._apduSender = Maybe.of(this._apduSenderFactory({ frameSize }));
      this._settleReconnectionPromiseResolvers.ifJust((promise) => {
        promise.resolve();
        this._settleReconnectionPromiseResolvers = Maybe.zero();
      });
      this._isDeviceReady = true;
    }
  }

  /**
   * Main event handler for BLE notify characteristic
   * Call _onReceiveSetupApduResponse if device mtu is not set
   * Call receiveApdu otherwise
   * @param event
   */
  private onNotifyCharacteristicValueChanged = (event: Event) => {
    if (!this.isDataViewEvent(event)) {
      return;
    }
    const {
      target: {
        value: { buffer },
      },
    } = event;
    if (!this._isDeviceReady) {
      this.onReceiveSetupApduResponse(buffer);
    } else {
      this.receiveApdu(buffer);
    }
  };

  /**
   * Setup BleDeviceConnection
   *
   * The device is considered as ready once the mtu had been set
   * APDU 0x0800000000 is used to get this mtu size
   */
  public async setup() {
    const requestMtuApdu = Uint8Array.from([0x08, 0x00, 0x00, 0x00, 0x00]);

    await this._notifyCharacteristic.startNotifications();
    await this._writeCharacteristic.writeValueWithoutResponse(requestMtuApdu);
  }

  /**
   * Receive APDU response
   * Resolve sendApdu promise once the framer receives all the frames of the response
   * @param data
   */
  receiveApdu(data: ArrayBuffer) {
    const response = this._apduReceiver.handleFrame(new Uint8Array(data));

    response
      .map((maybeApduResponse) => {
        maybeApduResponse.map((apduResponse) => {
          this._logger.debug("Received APDU Response", {
            data: { response: apduResponse },
          });
          this._sendApduPromiseResolver.map(({ resolve }) =>
            resolve(Right(apduResponse)),
          );
        });
      })
      .mapLeft((error) => {
        this._sendApduPromiseResolver.map(({ resolve }) =>
          resolve(Left(error)),
        );
      });
  }

  /**
   * Send apdu if the mtu had been set
   *
   * Get all frames for a given APDU
   * Save a promise that would be completed once the response had been received
   * @param apdu
   * @param triggersDisconnection
   */
  async sendApdu(
    apdu: Uint8Array,
    triggersDisconnection?: boolean,
  ): Promise<Either<DmkError, ApduResponse>> {
    if (!this._isDeviceReady) {
      return Promise.resolve(
        Left(new DeviceNotInitializedError("Unknown MTU")),
      );
    }
    // Create a promise that would be resolved once the response had been received
    const resultPromise = new Promise<Either<DmkError, ApduResponse>>(
      (resolve) => {
        this._sendApduPromiseResolver = Maybe.of({
          resolve,
        });
      },
    );
    const frames = this._apduSender.mapOrDefault(
      (apduSender) => apduSender.getFrames(apdu),
      [],
    );
    for (const frame of frames) {
      try {
        this._logger.debug("Sending Frame", {
          data: { frame: frame.getRawData() },
        });
        await this._writeCharacteristic.writeValueWithoutResponse(
          frame.getRawData(),
        );
      } catch (error) {
        this._logger.error("Error sending frame", { data: { error } });
      }
    }
    const response = await resultPromise;
    this._sendApduPromiseResolver = Maybe.zero();
    return response.caseOf({
      Right: async (apduResponse) => {
        if (
          triggersDisconnection &&
          CommandUtils.isSuccessResponse(apduResponse)
        ) {
          const reconnectionRes = await this.setupWaitForReconnection();
          return reconnectionRes.map(() => apduResponse);
        } else {
          return Right(apduResponse);
        }
      },
      Left: async (error) => Promise.resolve(Left(error)),
    });
  }

  /**
   * Typeguard to check if an event contains target value of type DataView
   *
   * @param event
   * @private
   */
  private isDataViewEvent(event: Event): event is DataViewEvent {
    return (
      event.target !== null &&
      "value" in event.target &&
      event.target.value instanceof DataView
    );
  }

  /**
   * Setup a promise that would be resolved once the device is reconnected
   *
   * @private
   */
  private setupWaitForReconnection(): Promise<Either<DmkError, void>> {
    return new Promise<Either<DmkError, void>>((resolve) => {
      this._settleReconnectionPromiseResolvers = Maybe.of({
        resolve: () => resolve(Right(undefined)),
        reject: (error: DmkError) => resolve(Left(error)),
      });
    });
  }

  /**
   * Reconnect to the device by resetting new ble characteristics
   * @param writeCharacteristic
   * @param notifyCharacteristic
   */
  public async reconnect(
    writeCharacteristic: BluetoothRemoteGATTCharacteristic,
    notifyCharacteristic: BluetoothRemoteGATTCharacteristic,
  ) {
    this._isDeviceReady = false;
    this.notifyCharacteristic = notifyCharacteristic;
    this.writeCharacteristic = writeCharacteristic;
    await this.setup();
  }

  /**
   * Disconnect from the device
   */
  public disconnect() {
    // if a reconnection promise is pending, reject it
    this._settleReconnectionPromiseResolvers.ifJust((promise) => {
      promise.reject(new ReconnectionFailedError());
      this._settleReconnectionPromiseResolvers = Maybe.zero();
    });
    this._isDeviceReady = false;
  }
}
