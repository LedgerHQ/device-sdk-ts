import {
  type ApduReceiverService,
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderService,
  type ApduSenderServiceFactory,
  type DeviceApduSender,
  type DmkError,
  formatApduReceivedLog,
  formatApduSentLog,
  FramerUtils,
  type LoggerPublisherService,
  OpeningConnectionError,
  type SendApduResult,
  SendApduTimeoutError,
} from "@ledgerhq/device-management-kit";
import { type Device as NodeHIDDevice, HIDAsync } from "node-hid";
import { type Either, Just, Left, Maybe, Nothing, Right } from "purify-ts";

import { FRAME_SIZE } from "@api/data/NodeHidConfig";
import { NodeHidSendReportError } from "@api/model/Errors";

const MAX_CHANNEL_VALUE = 0xffff;
const CHANNEL_BYTE_LENGTH = 2;
const DEVICE_OPEN_DELAY_MS = 300;

export type NodeHidApduSenderDependencies = {
  device: NodeHIDDevice;
};

export type NodeHidApduSenderConstructorArgs = {
  dependencies: NodeHidApduSenderDependencies;
  apduSenderFactory: ApduSenderServiceFactory;
  apduReceiverFactory: ApduReceiverServiceFactory;
  loggerFactory: (tag: string) => LoggerPublisherService;
};

export class NodeHidApduSender
  implements DeviceApduSender<NodeHidApduSenderDependencies>
{
  private dependencies: NodeHidApduSenderDependencies;
  private readonly apduSenderFactory: ApduSenderServiceFactory;
  private apduSender: ApduSenderService;
  private readonly apduReceiverFactory: ApduReceiverServiceFactory;
  private apduReceiver: ApduReceiverService;
  private readonly logger: LoggerPublisherService;
  private hidAsync: Maybe<HIDAsync>;
  private sendApduPromiseResolver: Maybe<
    (value: Either<DmkError, ApduResponse>) => void
  >;
  private abortTimeout: Maybe<ReturnType<typeof setTimeout>>;

  constructor({
    dependencies,
    apduSenderFactory,
    apduReceiverFactory,
    loggerFactory,
  }: NodeHidApduSenderConstructorArgs) {
    const channel = Maybe.of(
      FramerUtils.numberToByteArray(
        Math.floor(Math.random() * MAX_CHANNEL_VALUE),
        CHANNEL_BYTE_LENGTH,
      ),
    );
    this.dependencies = dependencies;
    this.apduSenderFactory = apduSenderFactory;
    this.apduSender = this.apduSenderFactory({
      frameSize: FRAME_SIZE,
      channel,
      padding: true,
    });
    this.apduReceiverFactory = apduReceiverFactory;
    this.apduReceiver = this.apduReceiverFactory({ channel });
    this.logger = loggerFactory("NodeHidApduSender");
    this.hidAsync = Nothing;
    this.sendApduPromiseResolver = Nothing;
    this.abortTimeout = Nothing;
  }

  public async sendApdu(
    apdu: Uint8Array,
    _triggersDisconnection?: boolean,
    abortTimeout?: number,
  ): Promise<SendApduResult> {
    return this.hidAsync.caseOf({
      Just: async (hidAsync) => {
        const resultPromise = new Promise<Either<DmkError, ApduResponse>>(
          (resolve) => {
            this.sendApduPromiseResolver = Just(resolve);
          },
        );

        for (const frame of this.apduSender.getFrames(apdu)) {
          try {
            const report = Buffer.from([0x00].concat([...frame.getRawData()]));
            await hidAsync.write(report);
          } catch (error) {
            this.logger.info("Error sending frame", { data: { error } });
            return Promise.resolve(Left(new NodeHidSendReportError(error)));
          }
        }

        this.logger.debug(formatApduSentLog(apdu));

        if (abortTimeout) {
          this.abortTimeout = Just(
            setTimeout(() => {
              this.logger.debug("[sendApdu] Abort timeout", {
                data: { abortTimeout },
              });
              this.resolvePendingApdu(
                Left(new SendApduTimeoutError("Abort timeout")),
              );
            }, abortTimeout),
          );
        }

        return resultPromise;
      },
      Nothing: () => {
        return Promise.resolve(
          Left(new OpeningConnectionError("Device not connected")),
        );
      },
    });
  }

  public getDependencies(): NodeHidApduSenderDependencies {
    return this.dependencies;
  }

  public setDependencies(dependencies: NodeHidApduSenderDependencies): void {
    this.dependencies = dependencies;
  }

  public async setupConnection(): Promise<void> {
    await this.hidAsync.caseOf({
      Just: async (hidAsync) => {
        try {
          await hidAsync.close();
          this.hidAsync = Nothing;
          this.sendApduPromiseResolver = Nothing;
          this.abortTimeout = Nothing;
        } catch (error) {
          this.logger.error("Error while closing device", {
            data: { device: this.dependencies.device, error },
          });
          throw error;
        }
      },
      Nothing: () => Promise.resolve(),
    });

    if (undefined === this.dependencies.device.path) {
      throw new Error("Missing device path");
    }

    await new Promise((resolve) => setTimeout(resolve, DEVICE_OPEN_DELAY_MS));

    this.hidAsync = Maybe.of(
      await HIDAsync.open(this.dependencies.device.path, {
        nonExclusive: true,
      }),
    );

    return this.hidAsync.caseOf({
      Just: (hidAsync) => {
        hidAsync.on("data", (data: Buffer) => this.receiveHidInputReport(data));
        hidAsync.on("error", (error) => {
          this.logger.error("Error while receiving data", { data: { error } });
          this.resolvePendingApdu(Left(new NodeHidSendReportError(error)));
        });
        this.logger.info("🔌 Connected to device");
      },
      Nothing: () => {
        const error = new Error("Error while opening device");
        this.logger.error(`Error while opening device`, { data: { error } });
        throw error;
      },
    });
  }

  public async closeConnection(): Promise<void> {
    return this.hidAsync.caseOf({
      Just: async (hidAsync) => {
        try {
          await hidAsync.close();
          this.hidAsync = Nothing;
          this.sendApduPromiseResolver = Nothing;
          this.abortTimeout = Nothing;
          this.logger.info("🔚 Disconnect");
        } catch (error) {
          this.logger.error("Error while closing device", {
            data: { device: this.dependencies.device, error },
          });
          throw error;
        }
      },
      Nothing: () => {
        return;
      },
    });
  }

  private receiveHidInputReport(buffer: Buffer) {
    const data = new Uint8Array(buffer);
    const maybeApduResponse = this.apduReceiver.handleFrame(data);

    maybeApduResponse
      .map((response) => {
        response.map((apduResponse) => {
          this.logger.debug(formatApduReceivedLog(apduResponse));
          this.resolvePendingApdu(Right(apduResponse));
        });
      })
      .mapLeft((error) => {
        this.resolvePendingApdu(Left(error));
      });
  }

  private resolvePendingApdu(result: Either<DmkError, ApduResponse>): void {
    this.abortTimeout.map((timeout) => {
      this.abortTimeout = Nothing;
      clearTimeout(timeout);
    });
    this.sendApduPromiseResolver.map((resolve) => {
      this.sendApduPromiseResolver = Nothing;
      resolve(result);
    });
  }
}
