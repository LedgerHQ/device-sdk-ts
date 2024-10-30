import { Maybe } from "purify-ts";

import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";

import { type ApduSenderService } from "./ApduSenderService";
import { type ApduSenderServiceConstructorArgs } from "./ApduSenderService";
import { DefaultApduSenderService } from "./DefaultApduSenderService";

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
