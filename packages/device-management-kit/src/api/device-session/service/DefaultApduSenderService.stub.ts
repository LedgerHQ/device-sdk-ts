import { Maybe } from "purify-ts";

import { type ApduSenderService } from "@api/device-session/service/ApduSenderService";
import { type ApduSenderServiceConstructorArgs } from "@api/device-session/service/ApduSenderService";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DefaultApduSenderService } from "@internal/device-session/service/DefaultApduSenderService";

export const defaultApduSenderServiceStubBuilder = (
  props: Partial<ApduSenderServiceConstructorArgs> = {},
  loggerFactory: (tag: string) => LoggerPublisherService,
): ApduSenderService =>
  new DefaultApduSenderService(
    {
      frameSize: 64,
      channel: Maybe.of(new Uint8Array([0x12, 0x34])),
      padding: true,
      ...props,
    },
    loggerFactory,
  );
