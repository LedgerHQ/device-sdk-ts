import { Maybe } from "purify-ts";

import { type ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import {
  DefaultApduSenderService,
  type DefaultApduSenderServiceConstructorArgs,
} from "@internal/device-session/service/DefaultApduSenderService";
import { type LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

export const defaultApduSenderServiceStubBuilder = (
  props: Partial<DefaultApduSenderServiceConstructorArgs> = {},
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
