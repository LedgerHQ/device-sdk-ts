import { Either, Left, Maybe, Right } from "purify-ts";

import { CommandUtils } from "@api/command/utils/CommandUtils";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { SdkError } from "@api/Error";
import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import type { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { DeviceConnection } from "@internal/transport/model/DeviceConnection";
import {
  DeviceNotInitializedError,
  ReconnectionFailedError,
} from "@internal/transport/model/Errors";

type BleDeviceConnectionConstructorArgs = {
  writeCharacteristic: BluetoothRemoteGATTCharacteristic;
  notifyCharacteristic: BluetoothRemoteGATTCharacteristic;
  apduSender: ApduSenderService;
  apduReceiver: ApduReceiverService;
  loggerFactory: (name: string) => LoggerPublisherService;
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
  private _apduSender: ApduSenderService;
  private readonly _apduReceiver: ApduReceiverService;
  private _isDeviceReady: boolean;
  private _sendApduPromiseResolver: Maybe<{
    resolve(value: Either<SdkError, ApduResponse>): void;
  }>;
  private _settleReconnectionPromiseResolvers: Maybe<{
    resolve(): void;
    reject(err: SdkError): void;
  }>;

  constructor({
    writeCharacteristic,
    notifyCharacteristic,
    apduSender,
    apduReceiver,
    loggerFactory,
  }: BleDeviceConnectionConstructorArgs) {
    this._apduSender = apduSender;
    this._apduReceiver = apduReceiver;
    this._logger = loggerFactory(BleDeviceConnection.name);
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
      this._apduSender.setFrameSize(frameSize);
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
  ): Promise<Either<SdkError, ApduResponse>> {
    if (!this._isDeviceReady) {
      return Promise.resolve(
        Left(new DeviceNotInitializedError("Unknown MTU")),
      );
    }
    // Create a promise that would be resolved once the response had been received
    const resultPromise = new Promise<Either<SdkError, ApduResponse>>(
      (resolve) => {
        this._sendApduPromiseResolver = Maybe.of({
          resolve,
        });
      },
    );
    const frames = this._apduSender.getFrames(apdu);
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
  private setupWaitForReconnection(): Promise<Either<SdkError, void>> {
    return new Promise<Either<SdkError, void>>((resolve) => {
      this._settleReconnectionPromiseResolvers = Maybe.of({
        resolve: () => resolve(Right(undefined)),
        reject: (error: SdkError) => resolve(Left(error)),
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
