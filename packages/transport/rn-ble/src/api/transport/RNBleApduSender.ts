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

import { PairingRefusedError, UnknownBleError } from "@api/model/Errors";
import {
  bulkPerfAddDuration,
  bulkPerfCount,
  bulkPerfIsActive,
  bulkPerfMark,
  bulkPerfMeasure,
  bulkPerfMeasureAsync,
  bulkPerfMeasureSinceMark,
  bulkPerfNow,
  bulkPerfRecordError,
  bulkPerfSetCounter,
} from "@api/utils/BulkApduPerf";

const FRAME_HEADER_SIZE = 3;
const WRITE_WITHOUT_RESPONSE_WINDOW_SIZE = 2;
const FIRE_AND_FORGET_WRITE_WITHOUT_RESPONSE = true;

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
  highConnectionPriorityRequested?: boolean;
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
  private _currentApduStartedAt: number | undefined = undefined;
  private _currentWriteLoopStartedAt: number | undefined = undefined;
  private _firstResponseNotificationAt: number | undefined = undefined;
  private _lastWriteCompletedAt: number | undefined = undefined;
  private _lastResponseCompletedAt: number | undefined = undefined;

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
    const maybeApduResponse = bulkPerfMeasure("ble.receiverHandleFrameMs", () =>
      this._apduReceiver.handleFrame(apdu),
    );

    maybeApduResponse
      .map((response) => {
        response.map((apduResponse) => {
          const responseCompletedAt = bulkPerfNow();
          bulkPerfMark("ble.responseCompleted", responseCompletedAt);
          bulkPerfCount("ble.completedResponses");
          if (this._lastWriteCompletedAt !== undefined) {
            bulkPerfCount("ble.lastWriteToResponseSamples");
            bulkPerfAddDuration(
              "ble.lastWriteToResponseMs",
              responseCompletedAt - this._lastWriteCompletedAt,
            );
            this._lastWriteCompletedAt = undefined;
          }
          this._lastResponseCompletedAt = responseCompletedAt;
          this._currentApduStartedAt = undefined;
          this._currentWriteLoopStartedAt = undefined;
          this._firstResponseNotificationAt = undefined;
          if (bulkPerfIsActive()) {
            bulkPerfCount("logs.receiveSkipped");
            bulkPerfCount("logs.bleReceiveSkipped");
          } else {
            bulkPerfMeasure("logs.receiveTotalMs", () => {
              bulkPerfMeasure("logs.bleReceiveTotalMs", () => {
                bulkPerfCount("logs.receiveCalls");
                bulkPerfCount("logs.bleReceiveCalls");
                const receivedLog = bulkPerfMeasure(
                  "ble.formatReceivedLogMs",
                  () => formatApduReceivedLog(apduResponse),
                );
                this._logger.debug(receivedLog);
              });
            });
          }
          this._sendApduPromiseResolver.map((resolve) => {
            const resolverCalledAt = bulkPerfNow();
            bulkPerfMark("ble.responseResolverCalled", resolverCalledAt);
            bulkPerfAddDuration(
              "breakdown.bleResponseCompleteToResolverCallMs",
              resolverCalledAt - responseCompletedAt,
            );
            bulkPerfCount("breakdown.bleResponseCompleteToResolverCallSamples");
            resolve(Right(apduResponse));
          });
        });
      })
      .mapLeft((error) => {
        bulkPerfRecordError(error);
        this._currentApduStartedAt = undefined;
        this._currentWriteLoopStartedAt = undefined;
        this._firstResponseNotificationAt = undefined;
        this._lastWriteCompletedAt = undefined;
        this._sendApduPromiseResolver.map((resolve) => resolve(Left(error)));
      });
  }

  private recordFirstResponseNotification(notificationReceivedAt: number) {
    if (this._firstResponseNotificationAt !== undefined) {
      return;
    }

    this._firstResponseNotificationAt = notificationReceivedAt;
    bulkPerfCount("ble.firstResponseNotificationCount");

    if (this._lastWriteCompletedAt !== undefined) {
      bulkPerfAddDuration(
        "ble.lastWriteToFirstNotificationMs",
        notificationReceivedAt - this._lastWriteCompletedAt,
      );
    }

    if (this._currentWriteLoopStartedAt !== undefined) {
      bulkPerfAddDuration(
        "ble.writeLoopStartToFirstNotificationMs",
        notificationReceivedAt - this._currentWriteLoopStartedAt,
      );
    }

    if (this._currentApduStartedAt !== undefined) {
      bulkPerfAddDuration(
        "ble.apduStartToFirstNotificationMs",
        notificationReceivedAt - this._currentApduStartedAt,
      );
    }
  }

  private onMonitor(characteristic: Characteristic) {
    if (!characteristic.value) {
      return;
    }

    const notificationReceivedAt = bulkPerfNow();
    bulkPerfCount("ble.notificationCount");
    const apdu = bulkPerfMeasure("ble.base64DecodeMs", () =>
      Base64.toUint8Array(characteristic.value!),
    );
    if (!this._isDeviceReady.value) {
      this.onReceiveSetupApduResponse(apdu);
    } else {
      this.recordFirstResponseNotification(notificationReceivedAt);
      this.receiveApdu(apdu);
    }
  }

  private write(value: string) {
    if (this._writeCharacteristic.isWritableWithoutResponse) {
      bulkPerfCount("ble.writeWithoutResponseCalls");
      return this._writeCharacteristic.writeWithoutResponse(value);
    }

    bulkPerfCount("ble.writeWithResponseCalls");
    return this._writeCharacteristic.writeWithResponse(value);
  }

  private getWriteWindowSize(): number {
    return this._writeCharacteristic.isWritableWithoutResponse
      ? WRITE_WITHOUT_RESPONSE_WINDOW_SIZE
      : 1;
  }

  private shouldFireAndForgetWrites(): boolean {
    return (
      FIRE_AND_FORGET_WRITE_WITHOUT_RESPONSE &&
      this._writeCharacteristic.isWritableWithoutResponse
    );
  }

  private async writeFrame(
    frame: ReturnType<ApduSenderService["getFrames"]>[number],
  ) {
    const writeFrameStart = bulkPerfNow();
    bulkPerfMeasureSinceMark(
      "fine.bleWriteLoopStartToFirstWriteFrameStartMs",
      "ble.writeLoopStartForFirstFrame",
      {
        counterName: "fine.bleWriteLoopStartToFirstWriteFrameStartSamples",
        end: writeFrameStart,
        clearMark: true,
      },
    );
    const rawFrame = bulkPerfMeasure("ble.getRawDataMs", () =>
      frame.getRawData(),
    );
    const encodedFrame = bulkPerfMeasure("ble.base64EncodeMs", () =>
      Base64.fromUint8Array(rawFrame),
    );
    const nativeWriteCallStart = bulkPerfNow();
    bulkPerfMeasureSinceMark(
      "fine.bleWriteLoopStartToFirstNativeWriteCallMs",
      "ble.writeLoopStartForFirstNativeWrite",
      {
        counterName: "fine.bleWriteLoopStartToFirstNativeWriteCallSamples",
        end: nativeWriteCallStart,
        clearMark: true,
      },
    );
    bulkPerfAddDuration(
      "fine.bleWriteFrameStartToNativeWriteCallMs",
      nativeWriteCallStart - writeFrameStart,
    );
    bulkPerfCount("fine.bleWriteFrameStartToNativeWriteCallSamples");
    bulkPerfCount("ble.writeCalls");
    await bulkPerfMeasureAsync("ble.writeMs", () => this.write(encodedFrame));
  }

  private async writeFrames(
    frames: ReturnType<ApduSenderService["getFrames"]>,
    writeWindowSize: number,
  ) {
    if (this.shouldFireAndForgetWrites()) {
      bulkPerfCount("ble.fireAndForgetApduCount");
      const pendingWrites = frames.map((frame) => {
        bulkPerfCount("ble.writePromisesNotAwaited");
        return this.writeFrame(frame).catch((error) => {
          bulkPerfCount("ble.writeAsyncErrors");
          this.failCurrentApduWithWriteError(error);
        });
      });
      void Promise.allSettled(pendingWrites).then(() => {
        bulkPerfCount("ble.fireAndForgetWriteSettledApduCount");
      });
      return;
    }

    if (writeWindowSize <= 1) {
      for (const frame of frames) {
        await this.writeFrame(frame);
      }
      return;
    }

    bulkPerfCount("ble.windowedApduCount");
    for (let index = 0; index < frames.length; index += writeWindowSize) {
      const frameBatch = frames.slice(index, index + writeWindowSize);
      bulkPerfCount("ble.writeWindowBatches");
      await Promise.all(frameBatch.map((frame) => this.writeFrame(frame)));
    }
  }

  private getWriteError(error: unknown): DmkError {
    bulkPerfCount("ble.writeErrors");
    bulkPerfRecordError(error);
    this._logger.info("Error sending frame", { data: { error } });
    this._currentApduStartedAt = undefined;
    this._currentWriteLoopStartedAt = undefined;
    this._firstResponseNotificationAt = undefined;
    this._lastWriteCompletedAt = undefined;
    this._sendApduPromiseResolver = Nothing;
    return new UnknownBleError(error);
  }

  private failCurrentApduWithWriteError(error: unknown): void {
    if (this._currentApduStartedAt === undefined) {
      return;
    }

    const resolver = this._sendApduPromiseResolver;
    const writeError = this.getWriteError(error);
    resolver.map((resolve) => resolve(Left(writeError)));
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
    this._currentApduStartedAt = undefined;
    this._currentWriteLoopStartedAt = undefined;
    this._firstResponseNotificationAt = undefined;
    this._lastWriteCompletedAt = undefined;
    this._lastResponseCompletedAt = undefined;
  }

  public async setupConnection() {
    this._characteristicSubscription =
      this._dependencies.device.monitorCharacteristicForService(
        this._dependencies.internalDevice.bleDeviceInfos.serviceUuid,
        this._dependencies.internalDevice.bleDeviceInfos.notifyUuid,
        (error, characteristic) => {
          if (error?.message.includes("notify change failed")) {
            // iOS pairing refused error
            this._isDeviceReady.error(new PairingRefusedError(error));
            this._logger.error("Pairing failed", {
              data: { error },
            });
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
    await this.write(Base64.fromUint8Array(requestMtuFrame)).catch((error) => {
      // Android pairing refused error
      this._logger.error("Pairing failed", {
        data: { error },
      });
      throw new PairingRefusedError(error);
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
    const bleEntryAt = bulkPerfNow();
    bulkPerfMark("ble.sendApduEntry", bleEntryAt);
    bulkPerfMeasureSinceMark(
      "fine.connectionTransportCallToBleEntryMs",
      "connection.transportCallStart",
      {
        counterName: "fine.connectionTransportCallToBleEntrySamples",
        end: bleEntryAt,
      },
    );

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

    bulkPerfSetCounter("ble.deviceMtu", this._dependencies.device.mtu ?? 0);
    bulkPerfSetCounter(
      "ble.isWritableWithoutResponse",
      this._writeCharacteristic.isWritableWithoutResponse ? 1 : 0,
    );
    bulkPerfSetCounter(
      "ble.highConnectionPriorityRequested",
      this._dependencies.highConnectionPriorityRequested ? 1 : 0,
    );
    const writeWindowSize = this.getWriteWindowSize();
    bulkPerfSetCounter("ble.writeWindowSize", writeWindowSize);
    bulkPerfSetCounter(
      "ble.writeFireAndForgetMode",
      this.shouldFireAndForgetWrites() ? 1 : 0,
    );

    const apduStart = bulkPerfNow();
    bulkPerfAddDuration("fine.bleEntryToApduStartMs", apduStart - bleEntryAt);
    bulkPerfCount("fine.bleEntryToApduStartSamples");
    bulkPerfMeasureSinceMark(
      "breakdown.bulkIterationEndToBleApduStartMs",
      "bulk.iterationComplete",
      { counterName: "breakdown.bulkIterationEndToBleApduStartSamples" },
    );
    bulkPerfMeasureSinceMark(
      "breakdown.bleResponseCompleteToNextBleApduStartMs",
      "ble.responseCompleted",
      { counterName: "breakdown.bleResponseCompleteToNextBleApduStartSamples" },
    );
    if (this._lastResponseCompletedAt !== undefined) {
      bulkPerfCount("ble.responseToNextApduStartSamples");
      bulkPerfAddDuration(
        "ble.responseToNextApduStartMs",
        apduStart - this._lastResponseCompletedAt,
      );
    }
    this._currentApduStartedAt = apduStart;
    this._firstResponseNotificationAt = undefined;

    const getFramesStart = bulkPerfNow();
    bulkPerfMark("ble.getFramesStart", getFramesStart);
    bulkPerfAddDuration(
      "fine.bleApduStartToGetFramesStartMs",
      getFramesStart - apduStart,
    );
    bulkPerfCount("fine.bleApduStartToGetFramesStartSamples");
    const frames = bulkPerfMeasure("ble.getFramesMs", () =>
      this._apduSender.caseOf({
        Just: (apduSender) => apduSender.getFrames(apdu),
        Nothing: () => [],
      }),
    );
    const getFramesEnd = bulkPerfNow();
    bulkPerfMark("ble.getFramesEnd", getFramesEnd);
    bulkPerfCount("ble.frameCount", frames.length);

    const writeLoopStart = bulkPerfNow();
    bulkPerfMark("ble.writeLoopStartForFirstFrame", writeLoopStart);
    bulkPerfMark("ble.writeLoopStartForFirstNativeWrite", writeLoopStart);
    bulkPerfAddDuration(
      "fine.bleGetFramesEndToWriteLoopStartMs",
      writeLoopStart - getFramesEnd,
    );
    bulkPerfCount("fine.bleGetFramesEndToWriteLoopStartSamples");
    bulkPerfMeasureSinceMark(
      "breakdown.bulkIterationEndToBleWriteStartMs",
      "bulk.iterationComplete",
      { counterName: "breakdown.bulkIterationEndToBleWriteStartSamples" },
    );
    bulkPerfMeasureSinceMark(
      "breakdown.bleResponseCompleteToNextBleWriteStartMs",
      "ble.responseCompleted",
      {
        counterName: "breakdown.bleResponseCompleteToNextBleWriteStartSamples",
      },
    );
    this._currentWriteLoopStartedAt = writeLoopStart;
    if (this._lastResponseCompletedAt !== undefined) {
      bulkPerfCount("ble.responseToNextWriteStartSamples");
      bulkPerfAddDuration(
        "ble.responseToNextWriteStartMs",
        writeLoopStart - this._lastResponseCompletedAt,
      );
      this._lastResponseCompletedAt = undefined;
    }

    let lastWriteCompletedAt: number;
    try {
      await this.writeFrames(frames, writeWindowSize);
      lastWriteCompletedAt = bulkPerfNow();
      this._lastWriteCompletedAt = lastWriteCompletedAt;
    } catch (error) {
      lastWriteCompletedAt = bulkPerfNow();
      bulkPerfAddDuration(
        "ble.writeLoopMs",
        lastWriteCompletedAt - writeLoopStart,
      );
      return Left(this.getWriteError(error));
    }
    bulkPerfAddDuration(
      "ble.writeLoopMs",
      lastWriteCompletedAt - writeLoopStart,
    );
    if (bulkPerfIsActive()) {
      bulkPerfCount("logs.sendSkipped");
      bulkPerfCount("logs.bleSendSkipped");
    } else {
      bulkPerfMeasure("logs.sendTotalMs", () => {
        bulkPerfMeasure("logs.bleSendTotalMs", () => {
          bulkPerfCount("logs.sendCalls");
          bulkPerfCount("logs.bleSendCalls");
          const sentLog = bulkPerfMeasure("ble.formatSentLogMs", () =>
            formatApduSentLog(apdu),
          );
          this._logger.debug(sentLog);
        });
      });
    }

    if (abortTimeout) {
      timeout = setTimeout(() => {
        bulkPerfCount("ble.timeoutCount");
        this._logger.debug("[sendApdu] Abort timeout triggered");
        this._sendApduPromiseResolver.map((resolve) =>
          resolve(Left(new SendApduTimeoutError("Abort timeout"))),
        );
      }, abortTimeout);
    }

    const result = await resultPromise;
    bulkPerfAddDuration("ble.apduTotalMs", bulkPerfNow() - apduStart);
    return result;
  }

  public closeConnection() {
    this._dependencies.device.cancelConnection();
  }
}
