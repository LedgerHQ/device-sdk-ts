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
  UnknownDeviceExchangeError,
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
  private _ready: Promise<void>;
  private _readyResolver!: () => void;
  private _serviceUuid: string;
  private _writeCmdUuid: string;
  private _notifyUuid: string;

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
    this._ready = Promise.resolve();
    this._serviceUuid = notifyCharacteristic.service.uuid;
    this._writeCmdUuid = writeCharacteristic.uuid;
    this._notifyUuid = notifyCharacteristic.uuid;
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
   * Event handler to setup the mtu size in response of 0x0800000000 APDU
   * @param value
   * @private
   */
  private onReceiveSetupApduResponse(value: ArrayBuffer) {
    const mtuResponse = new Uint8Array(value);
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
    if (buffer instanceof ArrayBuffer) {
      if (!this._isDeviceReady) {
        this.onReceiveSetupApduResponse(buffer);
      } else {
        this.receiveApdu(buffer);
      }
    }
  };

  /**
   * Setup BleDeviceConnection
   *
   * The device is considered as ready once the mtu had been set
   * APDU 0x0800000000 is used to get this mtu size
   */
  public async setup() {
    // reset the “ready” gate
    this._ready = new Promise((res) => (this._readyResolver = res));
    this._isDeviceReady = false;

    // ensure GATT is connected before we ask for notifications
    const device = this._notifyCharacteristic.service.device;
    if (!device.gatt?.connected) {
      this._logger.debug("GATT not connected in setup(), reconnecting…");
      await device.gatt!.connect();
    }

    // send the MTU-request APDU and resolve “ready” only once we see its response
    const requestMtu = Uint8Array.from([0x08, 0x00, 0x00, 0x00, 0x00]);
    const onMtu = (event: Event) => {
      const dv = (event.target as any).value as DataView;
      this.onReceiveSetupApduResponse(dv.buffer);
      this._notifyCharacteristic.removeEventListener(
        "characteristicvaluechanged",
        onMtu,
      );
      this._readyResolver();
    };

    this._notifyCharacteristic.addEventListener(
      "characteristicvaluechanged",
      onMtu,
    );

    // startNotifications, catching the “disconnected” case and reconnecting
    try {
      await this._notifyCharacteristic.startNotifications();
    } catch (err: any) {
      this._logger.warn(
        "startNotifications failed (disconnected), reconnecting GATT…",
        {
          data: { err },
        },
      );
      await device.gatt!.connect();
      await this._notifyCharacteristic.startNotifications();
    }

    // kick off the MTU request
    await this._writeCharacteristic.writeValueWithoutResponse(requestMtu);

    // wait until MTU response arrives
    await this._ready;
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
  public async sendApdu(
    apdu: Uint8Array,
    triggersDisconnection?: boolean,
  ): Promise<Either<DmkError, ApduResponse>> {
    const MAX_EXCHANGE_RETRIES = 2;
    let last: Either<DmkError, ApduResponse> = Left(
      new UnknownDeviceExchangeError("init"),
    );

    let didRerunSetup = false;

    for (let attempt = 1; attempt <= MAX_EXCHANGE_RETRIES; attempt++) {
      last = await this._sendOnce(apdu, triggersDisconnection);

      if (last.isRight()) break;
      const err = last.extract();

      if (
        err instanceof UnknownDeviceExchangeError &&
        attempt < MAX_EXCHANGE_RETRIES
      ) {
        this._logger.debug(
          `Attempt ${attempt} saw UnknownDeviceExchangeError, retrying…`,
        );
        await new Promise((r) => setTimeout(r, 100 * attempt));
        continue;
      }

      if (err instanceof DeviceNotInitializedError && !didRerunSetup) {
        this._logger.debug(
          `DeviceNotInitializedError, re-running MTU setup and retrying…`,
        );
        await this.setup();
        didRerunSetup = true;
        continue;
      }

      break;
    }

    return last;
  }

  /**
   * “One shot” sendApdu: write frames, await response (and handle a reboot-APDU).
   * Throws no reconnection; all that logic lives above.
   */
  private async _sendOnce(
    apdu: Uint8Array,
    triggersDisconnection?: boolean,
  ): Promise<Either<DmkError, ApduResponse>> {
    const device = this._notifyCharacteristic.service.device;

    // if the GATT link dropped, force a fresh setup
    if (!device.gatt?.connected) {
      this._logger.warn(
        "GATT disconnected before sending, re-running setup() to re-handshake MTU & notifications",
      );
      // resets _isDeviceReady & does MTU setup again
      return Left(new ReconnectionFailedError());
    }

    if (!this._isDeviceReady) {
      return Left(new DeviceNotInitializedError("Unknown MTU"));
    }

    // if this APDU reboots the device, prepare to wait
    let reconPromise: Promise<Either<DmkError, void>> | null = null;
    if (triggersDisconnection) {
      reconPromise = this.setupWaitForReconnection();
    }

    // send all the frames
    const responseP = new Promise<Either<DmkError, ApduResponse>>(
      (resolve) => (this._sendApduPromiseResolver = Maybe.of({ resolve })),
    );
    const frames = this._apduSender.mapOrDefault((s) => s.getFrames(apdu), []);
    for (const f of frames) {
      try {
        await this._writeCharacteristic.writeValueWithoutResponse(
          f.getRawData(),
        );
      } catch (e) {
        this._logger.error("Error writing frame", { data: { e } });
      }
    }

    const result = await responseP;
    this._sendApduPromiseResolver = Maybe.zero();

    return result.caseOf({
      Right: async (resp) => {
        if (triggersDisconnection && CommandUtils.isSuccessResponse(resp)) {
          await reconPromise!;
        }
        return Right(resp);
      },
      Left: async (err) => Left(err),
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
  public async reconnect() {
    // clear out old ready state & listener
    this._isDeviceReady = false;
    this._notifyCharacteristic.removeEventListener(
      "characteristicvaluechanged",
      this.onNotifyCharacteristicValueChanged,
    );

    // make sure the GATT server is connected
    const device = this._notifyCharacteristic.service.device;
    if (!device.gatt?.connected) {
      await device.gatt!.connect();
    }

    // re-discover
    const svc = await device?.gatt?.getPrimaryService(this._serviceUuid);
    const writeCharacteristic = await svc?.getCharacteristic(
      this._writeCmdUuid,
    );
    if (!writeCharacteristic) {
      throw new Error(
        `Failed to get write characteristic with UUID: ${this._writeCmdUuid}`,
      );
    }
    this._writeCharacteristic = writeCharacteristic;
    const notifyCharacteristic = await svc?.getCharacteristic(this._notifyUuid);
    if (!notifyCharacteristic) {
      throw new Error(
        `Failed to get notify characteristic with UUID: ${this._notifyUuid}`,
      );
    }
    this.notifyCharacteristic = notifyCharacteristic;

    // restart notifications & MTU handshake
    await this._notifyCharacteristic.startNotifications();
    this._notifyCharacteristic.addEventListener(
      "characteristicvaluechanged",
      this.onNotifyCharacteristicValueChanged,
    );
    await this.setup();

    // give the BLE stack a moment
    await new Promise((r) => setTimeout(r, 1000));
  }

  /**
   * Disconnect from the device
   */
  public disconnect() {
    this._settleReconnectionPromiseResolvers.ifJust((promise) => {
      promise.reject(new ReconnectionFailedError());
      this._settleReconnectionPromiseResolvers = Maybe.zero();
    });
    this._isDeviceReady = false;
  }
}
