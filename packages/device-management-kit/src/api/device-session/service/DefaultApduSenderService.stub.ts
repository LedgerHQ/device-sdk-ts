import { Maybe } from "purify-ts";

import { type ApduSenderService } from "@api/device-session/service/ApduSenderService";
import { type ApduSenderServiceConstructorArgs } from "@api/device-session/service/ApduSenderService";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DefaultApduSenderService } from "@internal/device-session/service/DefaultApduSenderService";

const DEFAULT_FRAME_SIZE = 64;
const STUB_CHANNEL_HIGH = 0x12;
const STUB_CHANNEL_LOW = 0x34;

export const defaultApduSenderServiceStubBuilder = (
  props: Partial<ApduSenderServiceConstructorArgs> = {},
  loggerFactory: (tag: string) => LoggerPublisherService,
): ApduSenderService =>
  new DefaultApduSenderService(
    {
      frameSize: DEFAULT_FRAME_SIZE,
      channel: Maybe.of(new Uint8Array([STUB_CHANNEL_HIGH, STUB_CHANNEL_LOW])),
      padding: true,
      ...props,
    },
    loggerFactory,
  );
