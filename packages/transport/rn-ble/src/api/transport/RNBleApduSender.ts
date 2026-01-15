import {
  type BleManager,
  type Characteristic,
  type Device,
  type Subscription as BleCharacteristicSubscription,
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
  formatApduReceivedLog,
  formatApduSentLog,
  type LoggerPublisherService,
  SendApduTimeoutError,
} from "@ledgerhq/device-management-kit";
import { Base64 } from "js-base64";
import { type Either, Left, Maybe, Nothing, Right } from "purify-ts";
import { BehaviorSubject, type Subscription } from "rxjs";

import {
  PairingRefusedError,
  PairingRefusedQuicklyError,
  UnknownBleError,
} from "@api/model/Errors";

const FRAME_HEADER_SIZE = 3;

/**
 * This is arbitrary but there is no better way to know if the pairing is refused too quickly to be considered a user action.
 * If the pairing is refused too quickly, we consider it as an automatic refusal and we throw a PairingRefusedQuicklyError.
 * If the pairing is refused after a longer period of time, we consider it as a genuine pairing refusal from the user and we throw a PairingRefusedError.
 */
const PAIRING_REFUSED_QUICKLY_LIMIT_MS = 1000;

export type RNBleInternalDevice = {
  id: DeviceId;
  bleDeviceInfos: BleDeviceInfos;
};

export type RNBleApduSenderConstructorArgs = {
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

  private _writeCharacteristic!: Characteristic;
  private _characteristicSubscription:
    | BleCharacteristicSubscription
    | undefined = undefined;

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
    const maybeApduResponse = this._apduReceiver.handleFrame(apdu);

    maybeApduResponse
      .map((response) => {
        response.map((apduResponse) => {
          this._logger.debug(formatApduReceivedLog(apduResponse));
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
    if (this._writeCharacteristic.isWritableWithoutResponse) {
      return this._writeCharacteristic.writeWithoutResponse(value);
    }

    return this._writeCharacteristic.writeWithResponse(value);
  }

  public getDependencies() {
    return this._dependencies;
  }

  public setDependencies(dependencies: RNBleApduSenderDependencies) {
    this._dependencies = dependencies;

    //Set dependencies mean we are reconnecting to a new device
    // So we need to reset the state of the sender
    this._isDeviceReady = new BehaviorSubject<boolean>(false);
    if (this._characteristicSubscription) {
      this._characteristicSubscription.remove();
      this._characteristicSubscription = undefined;
    }
  }

  public async setupConnection() {
    const setupConnectionStartTime = Date.now();

    this._characteristicSubscription =
      this._dependencies.device.monitorCharacteristicForService(
        this._dependencies.internalDevice.bleDeviceInfos.serviceUuid,
        this._dependencies.internalDevice.bleDeviceInfos.notifyUuid,
        (error, characteristic) => {
          /**
           * On iOS, when the pairing is refused, the error is caught here.
           */
          if (error?.message.includes("notify change failed")) {
            const duration = Date.now() - setupConnectionStartTime;
            this._logger.error(
              `[setupConnection][onMonitor] iOS pairing refused in ${duration}ms`,
              {
                data: { error, duration },
              },
            );
            if (duration < PAIRING_REFUSED_QUICKLY_LIMIT_MS) {
              this._isDeviceReady.error(new PairingRefusedQuicklyError(error));
            } else {
              this._isDeviceReady.error(new PairingRefusedError(error));
            }
            return;
          } else if (error) {
            this._isDeviceReady.error(new UnknownBleError(error));
            this._logger.error("Error monitoring characteristic", {
              data: { error },
            });
          }
          if (!error && characteristic) {
            this.onMonitor(characteristic);
          }
        },
      );

    // Setup Write characteristic
    const characteristics =
      await this._dependencies.manager.characteristicsForDevice(
        this._dependencies.device.id,
        this._dependencies.internalDevice.bleDeviceInfos.serviceUuid,
      );

    let tmpWriteCharacteristic = characteristics.find(
      (characteristic) =>
        characteristic.uuid ===
        this._dependencies.internalDevice.bleDeviceInfos.writeCmdUuid,
    );
    if (tmpWriteCharacteristic) {
      this._writeCharacteristic = tmpWriteCharacteristic;
    } else {
      tmpWriteCharacteristic = characteristics.find(
        (characteristic) =>
          characteristic.uuid ===
          this._dependencies.internalDevice.bleDeviceInfos.writeUuid,
      );

      //This should never happen
      if (tmpWriteCharacteristic) {
        this._writeCharacteristic = tmpWriteCharacteristic;
      } else {
        this._logger.error("No write characteristic found");
        throw new Error("No write characteristic found");
      }
    }

    const requestMtuFrame = Uint8Array.from([0x08, 0x00, 0x00, 0x00, 0x00]);

    const writeMtuFrameStartTime = Date.now();

    await this.write(Base64.fromUint8Array(requestMtuFrame)).catch((error) => {
      /**
       * On Android, when the pairing is refused, the error is caught here.
       */
      const duration = Date.now() - writeMtuFrameStartTime;
      this._logger.error(
        `[setupConnection][writeMtuFrame] Pairing failed (write mtu request) in ${duration}ms`,
        {
          data: { error, duration },
        },
      );
      if (duration < PAIRING_REFUSED_QUICKLY_LIMIT_MS) {
        throw new PairingRefusedQuicklyError(error);
      } else {
        throw new PairingRefusedError(error);
      }
    });
    let sub: Subscription | undefined;
    await new Promise<void>((resolve, reject) => {
      if (sub) {
        sub.unsubscribe();
      }

      sub = this._isDeviceReady.subscribe({
        next: (isReady) => {
          if (isReady) {
            resolve(); // FIXME: we should instead return a Right
          }
        },
        error: (error) => {
          reject(error); // FIXME: we should instead return a Left so it's properly typed
        },
      });
    });
  }

  async sendApdu(
    apdu: Uint8Array,
    _triggersDisconnection?: boolean,
    abortTimeout?: number,
  ): Promise<Either<DmkError, ApduResponse>> {
    if (!this._isDeviceReady.value) {
      return Promise.resolve(
        Left(new DeviceNotInitializedError("Unknown MTU")),
      );
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;

    const resultPromise = new Promise<Either<DmkError, ApduResponse>>(
      (resolve) => {
        this._sendApduPromiseResolver = Maybe.of((...args) => {
          if (timeout) {
            clearTimeout(timeout);
          }
          return resolve(...args);
        });
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
    this._logger.debug(formatApduSentLog(apdu));

    if (abortTimeout) {
      timeout = setTimeout(() => {
        this._logger.debug("[sendApdu] Abort timeout triggered");
        this._sendApduPromiseResolver.map((resolve) =>
          resolve(Left(new SendApduTimeoutError("Abort timeout"))),
        );
      }, abortTimeout);
    }

    return resultPromise;
  }

  public closeConnection() {
    this._dependencies.device.cancelConnection();
  }
}
