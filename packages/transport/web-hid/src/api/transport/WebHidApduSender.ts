import {
  type ApduReceiverService,
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderService,
  type ApduSenderServiceFactory,
  type DeviceApduSender,
  type DmkError,
  FramerUtils,
  type LoggerPublisherService,
  OpeningConnectionError,
  SendApduTimeoutError,
} from "@ledgerhq/device-management-kit";
import * as Sentry from "@sentry/minimal";
import { type Either, Left, Maybe, Nothing, Right } from "purify-ts";

import { FRAME_SIZE } from "@api/data/WebHidConfig";
import { WebHidSendReportError } from "@api/model/Errors";

export type WebHidApduSenderConstructorArgs = {
  dependencies: WebHidApduSenderDependencies;
  apduSenderFactory: ApduSenderServiceFactory;
  apduReceiverFactory: ApduReceiverServiceFactory;
};

export type WebHidApduSenderDependencies = {
  device: HIDDevice;
};

export class WebHidApduSender
  implements DeviceApduSender<WebHidApduSenderDependencies>
{
  private dependencies: WebHidApduSenderDependencies;
  private readonly apduSender: ApduSenderService;
  private readonly apduReceiver: ApduReceiverService;
  private sendApduPromiseResolver: Maybe<
    (value: Either<DmkError, ApduResponse>) => void
  >;
  private readonly logger: LoggerPublisherService;

  constructor(
    {
      dependencies,
      apduSenderFactory,
      apduReceiverFactory,
    }: WebHidApduSenderConstructorArgs,
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    const channel = Maybe.of(
      FramerUtils.numberToByteArray(Math.floor(Math.random() * 0xffff), 2),
    );
    this.logger = loggerServiceFactory("WebHidApduSender");
    this.apduSender = apduSenderFactory({
      frameSize: FRAME_SIZE,
      channel,
      padding: true,
    });
    this.apduReceiver = apduReceiverFactory({ channel });
    this.sendApduPromiseResolver = Nothing;
    this.dependencies = dependencies;
    this.logger.info("🔌 Connected to device");
  }

  async sendApdu(
    apdu: Uint8Array,
    _triggersDisconnection?: boolean,
    abortTimeout?: number,
  ): Promise<Either<DmkError, ApduResponse>> {
    this.logger.debug("[sendApdu]", {
      data: { apdu, abortTimeout },
    });

    let timeout: ReturnType<typeof setTimeout> | undefined;

    const resultPromise = new Promise<Either<DmkError, ApduResponse>>(
      (resolve) => {
        this.sendApduPromiseResolver = Maybe.of((...args) => {
          if (timeout) {
            clearTimeout(timeout);
          }
          return resolve(...args);
        });
      },
    );

    for (const frame of this.apduSender.getFrames(apdu)) {
      try {
        await this.dependencies.device.sendReport(
          0,
          new Uint8Array(frame.getRawData()),
        );
      } catch (error) {
        this.logger.info("Error sending frame", { data: { error } });
        return Promise.resolve(Left(new WebHidSendReportError(error)));
      }
    }

    if (abortTimeout) {
      timeout = setTimeout(() => {
        this.logger.debug("[sendApdu] Abort timeout", {
          data: { abortTimeout },
        });
        this.sendApduPromiseResolver.map((resolve) =>
          resolve(Left(new SendApduTimeoutError("Abort timeout"))),
        );
      }, abortTimeout);
    }

    return resultPromise;
  }

  private receiveHidInputReport(event: HIDInputReportEvent) {
    const data = new Uint8Array(event.data.buffer);
    const maybeApduResponse = this.apduReceiver.handleFrame(data);

    maybeApduResponse
      .map((response) => {
        response.map((apduResponse) => {
          this.logger.debug("Received APDU Response", {
            data: { response: apduResponse },
          });
          this.sendApduPromiseResolver.map((resolve) =>
            resolve(Right(apduResponse)),
          );
        });
      })
      .mapLeft((error) => {
        this.sendApduPromiseResolver.map((resolve) => resolve(Left(error)));
      });
  }

  public getDependencies() {
    return this.dependencies;
  }

  public setDependencies(dependencies: WebHidApduSenderDependencies) {
    this.dependencies = dependencies;
  }

  public async setupConnection() {
    try {
      this.dependencies.device.oninputreport = (event) =>
        this.receiveHidInputReport(event);
      await this.dependencies.device.open();
    } catch (error) {
      if (error instanceof DOMException && error.name === "InvalidStateError") {
        this.logger.info(`Device is already opened`);
      } else {
        const connectionError = new OpeningConnectionError(error);
        this.logger.error(`Error while opening device`, {
          data: { error },
        });
        Sentry.captureException(connectionError);
        throw error;
      }
    }
  }

  public closeConnection() {
    this.logger.info("🔚 Disconnect");
    try {
      this.dependencies.device.close();
    } catch (error) {
      this.logger.error("Error while closing device", {
        data: { device: this.dependencies.device, error },
      });
    }
  }
}
