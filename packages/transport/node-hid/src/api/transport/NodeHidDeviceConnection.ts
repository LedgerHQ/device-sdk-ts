import {
  type ApduReceiverService,
  type ApduResponse,
  type ApduSenderService,
  CommandUtils,
  type DeviceConnection,
  type DeviceId,
  type DmkError,
  type LoggerPublisherService,
  ReconnectionFailedError,
} from "@ledgerhq/device-management-kit";
import { type Device as NodeHIDDevice, HIDAsync } from "node-hid";
import { type Either, Left, Maybe, Nothing, Right } from "purify-ts";
import { Subject } from "rxjs";

import { RECONNECT_DEVICE_TIMEOUT } from "@api/data/NodeHidConfig";
import { NodeHidSendReportError } from "@api/model/Errors";

type NodeHidDeviceConnectionConstructorArgs = {
  device: NodeHIDDevice;
  deviceId: DeviceId;
  apduSender: ApduSenderService;
  apduReceiver: ApduReceiverService;
  onConnectionTerminated: () => void;
};

type Timer = ReturnType<typeof setTimeout>;

/**
 * Class to manage the connection with a USB HID device.
 * It sends APDU commands to the device and receives the responses.
 * It handles temporary disconnections and reconnections.
 */
export class NodeHidDeviceConnection implements DeviceConnection {
  private _device: NodeHIDDevice;
  private _connection: Promise<HIDAsync>;
  private _isConnected = false;
  private _deviceId: DeviceId;
  private readonly _apduSender: ApduSenderService;
  private readonly _apduReceiver: ApduReceiverService;
  private _sendApduSubject: Subject<ApduResponse> = new Subject();
  private readonly _logger: LoggerPublisherService;
  private _pendingApdu: Maybe<Uint8Array> = Nothing;

  /** Callback to notify the connection termination */
  private _onConnectionTerminated: () => void;
  /** Subject to notify the reconnection status */
  private reconnectionSubject: Subject<"success" | DmkError> = new Subject();
  /** Flag to indicate if the connection is waiting for a reconnection */
  private waitingForReconnection = false;
  /** Timeout to wait for the device to reconnect */
  private lostConnectionTimeout: Timer | null = null;
  /** Flag to indicate if the connection is terminated */
  private terminated = false;

  constructor(
    {
      device,
      deviceId,
      apduSender,
      apduReceiver,
      onConnectionTerminated,
    }: NodeHidDeviceConnectionConstructorArgs,
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._apduSender = apduSender;
    this._apduReceiver = apduReceiver;
    this._onConnectionTerminated = async () => {
      onConnectionTerminated();
      (await this._connection).close();
      this._isConnected = false;
    };
    this._logger = loggerServiceFactory("NodeHidDeviceConnection");
    this._device = device;
    this._connection = this.openConnection();
    this._deviceId = deviceId;
    this._logger.info("🔌 Connected to device");
  }

  public async ensureConnectionReady(): Promise<void> {
    await this.watchData();
  }

  public get device() {
    return this._device;
  }

  public get deviceId() {
    return this._deviceId;
  }

  async sendApdu(
    apdu: Uint8Array,
    triggersDisconnection?: boolean,
  ): Promise<Either<DmkError, ApduResponse>> {
    this._sendApduSubject = new Subject();
    this._pendingApdu = Maybe.of(apdu);
    this._logger.debug("Sending APDU", {
      data: { apdu },
      tag: "apdu-sender",
    });

    const resultPromise = new Promise<Either<DmkError, ApduResponse>>(
      (resolve) => {
        this._sendApduSubject.subscribe({
          next: async (r) => {
            this._pendingApdu = Nothing;
            if (triggersDisconnection && CommandUtils.isSuccessResponse(r)) {
              // Anticipate the disconnection and wait for the reconnection before resolving
              const reconnectionRes = await this.waitForReconnection();
              reconnectionRes.caseOf({
                Left: (err) => resolve(Left(err)),
                Right: () => resolve(Right(r)),
              });
            } else {
              resolve(Right(r));
            }
          },
          error: (err) => {
            this._pendingApdu = Nothing;
            resolve(Left(err));
          },
        });
      },
    );

    if (this.waitingForReconnection || !this._isConnected) {
      const waitingForDeviceResponse =
        this._isConnected && this._pendingApdu.isJust();
      const reconnectionRes = await this.waitForReconnection(
        waitingForDeviceResponse,
      );
      if (reconnectionRes.isLeft()) {
        return reconnectionRes;
      }
    }

    const frames = this._apduSender.getFrames(apdu);
    const connection = await this._connection;
    for (const frame of frames) {
      this._logger.debug("Sending Frame", {
        data: { frame: frame.getRawData() },
      });

      try {
        const report = Buffer.from([0, ...frame.getRawData()]);
        await connection.write(report);
      } catch (error) {
        this._logger.error("Error sending frame", { data: { error } });
        return Promise.resolve(Left(new NodeHidSendReportError(error)));
      }
    }

    return resultPromise;
  }

  private openConnection() {
    this._isConnected = false;
    if (!this._device.path) throw new Error("Missing device path");
    return HIDAsync.open(this._device.path).then((connection) => {
      this._isConnected = true;
      return connection;
    });
  }

  private async watchData() {
    const connection = await this._connection;
    connection.on("data", (data: Buffer) => this.receiveHidInputReport(data));
  }

  private receiveHidInputReport(buffer: Buffer) {
    const data = new Uint8Array(buffer);
    this._logger.debug("Received Frame", {
      data: { frame: data },
      tag: "apdu-receiver",
    });
    const response = this._apduReceiver.handleFrame(data);
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
      Left: (err) => {
        // Ignoring frame parsing error (no pending APDU)
        if (this._pendingApdu.isJust()) {
          this._sendApduSubject.error(err);
        } 
      },
    });
  }

  private waitForReconnection(
    waitingForDeviceResponse: boolean = false,
  ): Promise<Either<DmkError, void>> {
    if (this.terminated) {
      return Promise.resolve(Left(new ReconnectionFailedError()));
    }

    return new Promise<Either<DmkError, void>>((resolve) => {
      const sub = this.reconnectionSubject.subscribe({
        next: (res) => {
          if (waitingForDeviceResponse) {
            this._sendApduSubject.error(
              new NodeHidSendReportError(
                new Error(
                  "Device disconnected while waiting for device response",
                ),
              ),
            );
          }

          if (res === "success") {
            resolve(Right(undefined));
          } else {
            resolve(Left(res));
          }

          sub.unsubscribe();
        },
      });
    });
  }

  /**
   * Method called when the Device gets disconnected.
   * It starts a timeout to wait for the device to reconnect.
   * */
  public lostConnection() {
    this._logger.info("⏱️ Lost connection, starting timer");
    this.waitingForReconnection = true;
    this.lostConnectionTimeout = setTimeout(() => {
      this._logger.info("❌ Disconnection timeout, terminating connection");
      this.disconnect();
    }, RECONNECT_DEVICE_TIMEOUT);
  }

  /** Reconnect the device after a disconnection */
  public async reconnectHidDevice(device: NodeHIDDevice) {
    this._device = device;
    this.watchData();

    if (this.lostConnectionTimeout) {
      clearTimeout(this.lostConnectionTimeout);
    }

    if (this._pendingApdu.isJust()) {
      this._sendApduSubject.error(new NodeHidSendReportError());
    }

    this._connection = this.openConnection();
    await this._connection;

    this._logger.info("⏱️🔌 Device reconnected");
    this.waitingForReconnection = false;
    this.reconnectionSubject.next("success");
  }

  public async disconnect() {
    if (this._pendingApdu.isJust()) {
      this._sendApduSubject.error(new NodeHidSendReportError());
    }

    this._logger.info("🔚 Disconnect");
    if (this.lostConnectionTimeout) clearTimeout(this.lostConnectionTimeout);
    this.terminated = true;
    this._onConnectionTerminated();
  }
}
