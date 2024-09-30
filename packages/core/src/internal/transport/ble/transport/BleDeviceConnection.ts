import { Either, Left, Maybe, Nothing, Right } from "purify-ts";
import { Subject } from "rxjs";

import { CommandUtils } from "@api/command/utils/CommandUtils";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { SdkError } from "@api/Error";
import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import { DefaultApduSenderServiceConstructorArgs } from "@internal/device-session/service/DefaultApduSenderService";
import type { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { DeviceConnection } from "@internal/transport/model/DeviceConnection";
import {
  DeviceNotInitializedError,
  ReconnectionFailedError,
} from "@internal/transport/model/Errors";

type BleDeviceConnectionConstructorArgs = {
  writeCharacteristic: BluetoothRemoteGATTCharacteristic;
  notifyCharacteristic: BluetoothRemoteGATTCharacteristic;
  apduSenderFactory: (
    args: DefaultApduSenderServiceConstructorArgs,
  ) => ApduSenderService;
  apduReceiverFactory: () => ApduReceiverService;
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
  private readonly _apduSenderFactory: (
    args: DefaultApduSenderServiceConstructorArgs,
  ) => ApduSenderService;
  private readonly _apduReceiver: ApduReceiverService;
  private _isDeviceReady: boolean;
  private _sendApduSubject: Subject<ApduResponse>;
  private _settleReconnectionPromise: Maybe<{
    resolve(): void;
    reject(err: SdkError): void;
  }> = Maybe.zero();

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
    this._notifyCharacteristic.addEventListener(
      "characteristicvaluechanged",
      this.onNotifyCharacteristicValueChanged,
    );
    this._isDeviceReady = false;
    this._sendApduSubject = new Subject();
  }

  private set notifyCharacteristic(
    notifyCharacteristic: BluetoothRemoteGATTCharacteristic,
  ) {
    this._notifyCharacteristic = notifyCharacteristic;
    this._notifyCharacteristic.addEventListener(
      "characteristicvaluechanged",
      this.onNotifyCharacteristicValueChanged,
    );
  }

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
      this._settleReconnectionPromise.ifJust((promise) => {
        promise.resolve();
        this._settleReconnectionPromise = Maybe.zero();
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
    const apdu = Uint8Array.from([0x08, 0x00, 0x00, 0x00, 0x00]);

    await this._notifyCharacteristic.startNotifications();
    await this._writeCharacteristic.writeValueWithResponse(apdu);
  }

  /**
   * Receive APDU response
   * Complete sendApdu subject once the framer receives all the frames of the response
   * @param data
   */
  receiveApdu(data: ArrayBuffer) {
    const response = this._apduReceiver.handleFrame(new Uint8Array(data));

    response.caseOf({
      Right: (maybeApduResponse) => {
        maybeApduResponse.map((apduResponse) => {
          this._sendApduSubject.next(apduResponse);
          this._sendApduSubject.complete();
        });
      },
      Left: (error) => this._sendApduSubject.error(error),
    });
  }

  /**
   * Send apdu if the mtu had been set
   *
   * Get all frames for a given APDU
   * Subscribe to a Subject that would be complete once the response had been received
   * @param apdu
   */
  async sendApdu(
    apdu: Uint8Array,
    triggersDisconnection?: boolean,
  ): Promise<Either<SdkError, ApduResponse>> {
    this._sendApduSubject = new Subject();

    if (!this._isDeviceReady) {
      return Promise.resolve(
        Left(new DeviceNotInitializedError("Unknown MTU")),
      );
    }
    // Create a promise that would be resolved once the response had been received
    const resultPromise = new Promise<Either<SdkError, ApduResponse>>(
      (resolve) => {
        this._sendApduSubject.subscribe({
          next: async (response) => {
            if (
              triggersDisconnection &&
              CommandUtils.isSuccessResponse(response)
            ) {
              const reconnectionRes = await this.setupWaitForReconnection();
              reconnectionRes.caseOf({
                Left: (err) => resolve(Left(err)),
                Right: () => resolve(Right(response)),
              });
            } else {
              resolve(Right(response));
            }
          },
          error: (err) => resolve(Left(err)),
        });
      },
    );
    const frames = this._apduSender.caseOf({
      Just: (apduSender) => apduSender.getFrames(apdu),
      Nothing: () => [],
    });
    for (const frame of frames) {
      try {
        await this._writeCharacteristic.writeValueWithResponse(
          frame.getRawData(),
        );
      } catch (error) {
        this._logger.error("Error sending frame", { data: { error } });
      }
    }
    return resultPromise;
  }

  /**
   * Typeguard to check if an event contains target value of type DataView
   *
   * @param event
   * @private
   */
  private isDataViewEvent(event: Event): event is DataViewEvent {
    return (
      typeof event.target === "object" &&
      event.target !== null &&
      "value" in event.target &&
      typeof event.target.value === "object" &&
      event.target.value !== null &&
      "buffer" in event.target.value &&
      typeof event.target.value.buffer === "object" &&
      event.target.value.buffer !== null &&
      "byteLength" in event.target.value.buffer &&
      typeof event.target.value.buffer.byteLength === "number"
    );
  }

  /**
   * Setup a promise that would be resolved once the device is reconnected
   *
   * @private
   */
  private setupWaitForReconnection(): Promise<Either<SdkError, void>> {
    return new Promise<Either<SdkError, void>>((resolve) => {
      this._settleReconnectionPromise = Maybe.of({
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
    this._notifyCharacteristic.removeEventListener(
      "characteristicvaluechanged",
      this.onNotifyCharacteristicValueChanged,
    );
    this._isDeviceReady = false;
    this.notifyCharacteristic = notifyCharacteristic;
    this.writeCharacteristic = writeCharacteristic;
    await this.setup();
  }

  /**
   * Disconnect from the device
   */
  public async disconnect() {
    // if a reconnection promise is pending, reject it
    this._settleReconnectionPromise.ifJust((promise) => {
      promise.reject(new ReconnectionFailedError());
      this._settleReconnectionPromise = Maybe.zero();
    });
    this._notifyCharacteristic.removeEventListener(
      "characteristicvaluechanged",
      this.onNotifyCharacteristicValueChanged,
    );
    this._isDeviceReady = false;
  }
}
