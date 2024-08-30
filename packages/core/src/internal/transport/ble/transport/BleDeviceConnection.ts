import { Either, Left, Maybe, Nothing, Right } from "purify-ts";
import { Subject } from "rxjs";

import { ApduResponse } from "@api/device-session/ApduResponse";
import { SdkError } from "@api/Error";
import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import { DefaultApduSenderServiceConstructorArgs } from "@internal/device-session/service/DefaultApduSenderService";
import type { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { DeviceConnection } from "@internal/transport/model/DeviceConnection";
import { DeviceNotInitializedError } from "@internal/transport/model/Errors";

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
  private readonly _writeCharacteristic: BluetoothRemoteGATTCharacteristic;
  private readonly _notifyCharacteristic: BluetoothRemoteGATTCharacteristic;
  private readonly _logger: LoggerPublisherService;
  private _apduSender: Maybe<ApduSenderService>;
  private readonly _apduSenderFactory: (
    args: DefaultApduSenderServiceConstructorArgs,
  ) => ApduSenderService;
  private readonly _apduReceiver: ApduReceiverService;
  private _isDeviceReady: boolean;
  private _sendApduSubject: Subject<ApduResponse>;

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
    this._isDeviceReady = false;
    this._notifyCharacteristic.addEventListener(
      "characteristicvaluechanged",
      this.onNotifyCharacteristicValueChanged,
    );
    this._sendApduSubject = new Subject();
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
      this._isDeviceReady = true;
      this._logger.debug("new frame size value change", {
        data: { frameSize },
      });
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
      return this.onReceiveSetupApduResponse(buffer);
    }
    return this.receiveApdu(buffer);
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
  async receiveApdu(data: ArrayBuffer) {
    const response = this._apduReceiver.handleFrame(new Uint8Array(data));

    response.caseOf({
      Right: (maybeApduResponse) => {
        maybeApduResponse.map((apduResponse) => {
          this._logger.debug("Received APDU Response", {
            data: { response: apduResponse },
          });
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
  async sendApdu(apdu: Uint8Array): Promise<Either<SdkError, ApduResponse>> {
    if (!this._isDeviceReady) {
      return Left(new DeviceNotInitializedError());
    }
    this._sendApduSubject = new Subject();

    const resultPromise = new Promise<Either<SdkError, ApduResponse>>(
      (resolve) => {
        this._sendApduSubject.subscribe({
          next: async (response) => {
            resolve(Right(response));
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
}
