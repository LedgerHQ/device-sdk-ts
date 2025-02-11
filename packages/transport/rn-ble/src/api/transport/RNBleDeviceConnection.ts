import { type Characteristic } from "react-native-ble-plx";
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
import { Base64 } from "js-base64";
import { type Either, Left, Maybe, Nothing, Right } from "purify-ts";

type RNBleDeviceConnectionConstructorArgs = {
  onWrite: (value: string) => Promise<Characteristic>;
  apduSenderFactory: ApduSenderServiceFactory;
  apduReceiverFactory: ApduReceiverServiceFactory;
};

export class RNBleDeviceConnection implements DeviceConnection {
  private _isDeviceReady: boolean;
  private _logger: LoggerPublisherService;
  private _apduSender: Maybe<ApduSenderService>;
  private readonly _apduSenderFactory: ApduSenderServiceFactory;
  private readonly _apduReceiver: ApduReceiverService;
  private _sendApduPromiseResolver: Maybe<{
    resolve(value: Either<DmkError, ApduResponse>): void;
  }>;
  private _onWrite: (value: string) => Promise<Characteristic>;
  private _settleReconnectionPromiseResolvers: Maybe<{
    resolve(): void;
    reject(err: DmkError): void;
  }>;

  constructor(
    {
      onWrite,
      apduSenderFactory,
      apduReceiverFactory,
    }: RNBleDeviceConnectionConstructorArgs,
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._isDeviceReady = false;
    this._logger = loggerServiceFactory("RNBleDeviceConnection");
    this._apduSenderFactory = apduSenderFactory;
    this._apduSender = Nothing;
    this._apduReceiver = apduReceiverFactory();
    this._sendApduPromiseResolver = Nothing;
    this._settleReconnectionPromiseResolvers = Maybe.zero();
    this._onWrite = onWrite;
  }

  /**
   * Sets the onWrite event handler that will be invoked when a write operation occurs.
   *
   * @param {Function} onWrite - A function that handles the write event.
   * It should take a string value as an argument and return a Promise resolving to a Characteristic.
   */
  public set onWrite(onWrite: (value: string) => Promise<Characteristic>) {
    this._onWrite = onWrite;
  }

  /**
   * Handles the monitoring of the given characteristic, processes incoming data
   * if the characteristic contains a value, and invokes relevant methods based
   * on the device's current readiness state.
   *
   * @param {Characteristic} characteristic - The characteristic object that contains the value to be monitored.
   * @return {void} Does not return a value; performs actions based on the received data and device state.
   */
  public onMonitor(characteristic: Characteristic): void {
    if (!characteristic.value) {
      return;
    }
    // This frame is sent by the device when user interaction is required (confirm open app or list app for exemple)
    // If it's not ignored sendApdu encounter a `ReceiverApduError` error
    const ignoredFrame = "BQAB"; // [0x05, 0x00, 0x01];

    const apdu = Base64.toUint8Array(characteristic.value);

    if (!this._isDeviceReady) {
      this.onReceiveSetupApduResponse(apdu);
    } else if (characteristic.value !== ignoredFrame) {
      this.receiveApdu(apdu);
    }
  }

  /**
   * Initializes the setup process by sending a predefined APDU command.
   *
   * The method constructs a request APDU command for MTU and then asynchronously writes it using the internal `_onWrite` method.
   *
   * @return {Promise<void>} A promise that resolves when the setup process completes successfully.
   */
  public async setup(): Promise<void> {
    const requestMtuApdu = Uint8Array.from([0x08, 0x00, 0x00, 0x00, 0x00]);

    await this._onWrite(Base64.fromUint8Array(requestMtuApdu));
  }

  /**
   * Sends an Application Protocol Data Unit (APDU) to the device and waits for a response.
   *
   * This method handles sending APDU frames, resolving the communication promise, and optionally
   * preparing for a reconnection if disconnection is triggered by the operation.
   *
   * @param {Uint8Array} apdu - The APDU data to be sent to the device.
   * @param {boolean} [triggersDisconnection] - Optional flag indicating whether this operation will trigger a disconnection. Defaults to `false`.
   * @return {Promise<Either<DmkError, ApduResponse>>} A promise resolving to an `Either` type containing a `DmkError` in case of failure or an `ApduResponse` in case of success.
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
    const resultPromise = new Promise<Either<DmkError, ApduResponse>>(
      (resolve) => {
        this._sendApduPromiseResolver = Maybe.of({ resolve });
      },
    );

    const frames = this._apduSender.caseOf({
      Just: (apduSender) => apduSender.getFrames(apdu),
      Nothing: () => [],
    });

    for (const frame of frames) {
      try {
        await this._onWrite(Base64.fromUint8Array(frame.getRawData()));
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
        }
        return Right(apduResponse);
      },
      Left: async (error) => Promise.resolve(Left(error)),
    });
  }

  /**
   * Attempts to reconnect by resetting the device state and reinitializing the setup process.
   *
   * @return {Promise<void>} A promise that resolves when the device has been reinitialized successfully.
   */
  public async reconnect(): Promise<void> {
    this._isDeviceReady = false;
    await this.setup();
  }

  /**
   * Disconnects the device and interrupts any ongoing reconnection attempt.
   * If a reconnection promise is pending, it is rejected with a ReconnectionFailedError.
   * Marks the device as not ready after disconnection.
   *
   * @return {void} Does not return any value.
   */
  public disconnect(): void {
    // if a reconnection promise is pending, reject it
    this._settleReconnectionPromiseResolvers.ifJust((promise) => {
      promise.reject(new ReconnectionFailedError());
      this._settleReconnectionPromiseResolvers = Maybe.zero();
    });
    this._isDeviceReady = false;
  }

  /**
   * Handles the response received for the setup APDU operation.
   * Parses the response to extract frame size, initializes the APDU sender,
   * and resolves any pending reconnection promises if applicable.
   *
   * @param {Uint8Array} value - The response received from the device containing the setup APDU data.
   * @return {void} This method does not return any value.
   */
  private onReceiveSetupApduResponse(value: Uint8Array): void {
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
   * Processes an Application Protocol Data Unit (APDU) by sending it to the
   * receiver, handling the response, and resolving the appropriate promise
   * based on the result.
   *
   * @param {Uint8Array} apdu - The input APDU data to be processed.
   * @return {void} This method does not return a value but resolves internal
   * promises with the APDU response or an error.
   */
  private receiveApdu(apdu: Uint8Array): void {
    const response = this._apduReceiver.handleFrame(apdu);

    response
      .map((maybeApduResponse) => {
        maybeApduResponse.map((apduResponse) => {
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
}
