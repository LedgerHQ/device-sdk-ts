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
  private _mtuHandshakeComplete: boolean;
  private _pendingApduResponseResolver: Maybe<{
    resolve(value: Either<DmkError, ApduResponse>): void;
  }>;
  private _reconnectionPromiseHandlers: Maybe<{
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
    this._mtuHandshakeComplete = false;
    this._pendingApduResponseResolver = Maybe.zero();
    this._reconnectionPromiseHandlers = Maybe.zero();
    this._ready = Promise.resolve();
    this._serviceUuid = notifyCharacteristic.service?.uuid ?? "";
    this._writeCmdUuid = writeCharacteristic?.uuid ?? "";
    this._notifyUuid = notifyCharacteristic?.uuid ?? "";
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
   * Process BLE MTU setup response and complete the handshake.
   * Parses the MTU response, extracts the negotiated frame size,
   * initialises the APDU sender, and resolves any pending reconnection promises.
   *
   * @param dataBuffer - raw MTU response data from the device.
   * @private
   */
  private handleMtuSetupResponse(dataBuffer: ArrayBuffer) {
    const mtuResponse = new Uint8Array(dataBuffer);
    const [frameSize] = mtuResponse.slice(5);
    if (frameSize) {
      this._apduSender = Maybe.of(this._apduSenderFactory({ frameSize }));
      this._reconnectionPromiseHandlers.ifJust((promise) => {
        promise.resolve();
        this._reconnectionPromiseHandlers = Maybe.zero();
      });
      this._mtuHandshakeComplete = true;
    }
  }

  /**
   * Main event handler for BLE notify characteristic
   * Call handleMtuSetupResponse if device mtu is not set
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
      if (!this._mtuHandshakeComplete) {
        this.handleMtuSetupResponse(buffer);
      } else {
        this.receiveApdu(buffer);
      }
    }
  };

  /**
   * Setup BleDeviceConnection
   *
   * The device is considered as ready once the mtu had been set
   * 0x0800000000 is used to get this mtu size
   */
  public async setup() {
    // reset the “ready” gate
    this._ready = new Promise((resolve) => (this._readyResolver = resolve));
    this._mtuHandshakeComplete = false;

    // ensure GATT is connected before we ask for notifications
    const service: BluetoothRemoteGATTService | undefined =
      this._notifyCharacteristic.service;
    const device = service?.device;
    if (device) {
      if (!device.gatt?.connected) {
        this._logger.debug("GATT not connected in setup(), reconnecting…");
        const gatt = device.gatt;
        if (!gatt) {
          throw new Error("GATT server not available on device");
        }
        if (!gatt.connected) {
          this._logger.debug("GATT not connected in setup(), reconnecting…");
          await gatt.connect();
        }
      }
    } else {
      this._readyResolver();
      this._logger.debug(
        "No service on notifyCharacteristic, skipping GATT / MTU handshake.",
      );
    }

    // listen for the MTU response, resolve “ready,” and complete the handshake
    const requestMtu = Uint8Array.from([0x08, 0x00, 0x00, 0x00, 0x00]);
    const onMtu = (event: Event) => {
      if (!this.isDataViewEvent(event)) return;
      const dataView = event.target.value;
      this.handleMtuSetupResponse(dataView.buffer);
      this._notifyCharacteristic.removeEventListener(
        "characteristicvaluechanged",
        onMtu,
      );
      this._readyResolver();
      this._mtuHandshakeComplete = true;
    };

    this._notifyCharacteristic.addEventListener(
      "characteristicvaluechanged",
      onMtu,
    );

    // startNotifications, catching the “disconnected” case and reconnecting
    try {
      await this._notifyCharacteristic.startNotifications();
    } catch (err) {
      this._logger.warn(
        "startNotifications failed (disconnected), reconnecting GATT…",
        {
          data: { err },
        },
      );
      const gatt = device.gatt;
      if (!gatt) {
        throw new Error("GATT server not available on device");
      }
      await gatt.connect();
      await this._notifyCharacteristic.startNotifications();
    }

    await this._writeCharacteristic.writeValueWithoutResponse(requestMtu);

    if (service?.device) {
      await this._ready;
    }
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
          this._pendingApduResponseResolver.map(({ resolve }) =>
            resolve(Right(apduResponse)),
          );
        });
      })
      .mapLeft((error) => {
        this._pendingApduResponseResolver.map(({ resolve }) =>
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
    if (!this._mtuHandshakeComplete) {
      return Left(new DeviceNotInitializedError("Unknown MTU"));
    }

    const device = this._notifyCharacteristic.service?.device;
    if (device && !device.gatt?.connected) {
      this._logger.warn(
        "GATT disconnected before sending, re-running setup() to re-handshake MTU & notifications",
      );
      return Left(new ReconnectionFailedError());
    }

    // if this APDU reboots the device, prepare to wait
    let reconPromise: Promise<Either<DmkError, void>> | null = null;
    if (triggersDisconnection) {
      reconPromise = this.setupWaitForReconnection();
    }

    // send all the frames
    const responseP = new Promise<Either<DmkError, ApduResponse>>(
      (resolve) => (this._pendingApduResponseResolver = Maybe.of({ resolve })),
    );
    const frames = this._apduSender.mapOrDefault((s) => s.getFrames(apdu), []);
    for (const frame of frames) {
      try {
        await this._writeCharacteristic.writeValueWithoutResponse(
          frame.getRawData(),
        );
      } catch (error) {
        this._logger.error("Error writing frame", { data: { error } });
      }
    }

    const result = await responseP;
    this._pendingApduResponseResolver = Maybe.zero();

    return result.caseOf({
      Right: async (resp) => {
        if (triggersDisconnection && CommandUtils.isSuccessResponse(resp)) {
          await reconPromise!;
        }
        return Right(resp);
      },
      Left: async (err) => Promise.resolve(Left(err)),
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
      this._reconnectionPromiseHandlers = Maybe.of({
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
    this._mtuHandshakeComplete = false;
    this._notifyCharacteristic.removeEventListener(
      "characteristicvaluechanged",
      this.onNotifyCharacteristicValueChanged,
    );

    // make sure the GATT server is connected
    const device = this._notifyCharacteristic.service.device;
    const gatt = device.gatt;
    if (!gatt) {
      throw new Error("GATT server not available on device");
    }
    if (!gatt.connected) {
      await gatt.connect();
    }

    // re-discover
    const gattPrimaryService = await device?.gatt?.getPrimaryService(
      this._serviceUuid,
    );
    const writeCharacteristic = await gattPrimaryService?.getCharacteristic(
      this._writeCmdUuid,
    );
    if (!writeCharacteristic) {
      throw new Error(
        `Failed to get write characteristic with UUID: ${this._writeCmdUuid}`,
      );
    }
    this._writeCharacteristic = writeCharacteristic;
    const notifyCharacteristic = await gattPrimaryService?.getCharacteristic(
      this._notifyUuid,
    );
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
    this._reconnectionPromiseHandlers.ifJust((promise) => {
      promise.reject(new ReconnectionFailedError());
      this._reconnectionPromiseHandlers = Maybe.zero();
    });
    this._mtuHandshakeComplete = false;
  }
}
