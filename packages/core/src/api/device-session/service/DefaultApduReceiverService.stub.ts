import { Maybe } from "purify-ts";

import { type LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import { type ApduReceiverService } from "./ApduReceiverService";
import { type ApduReceiverConstructorArgs } from "./ApduReceiverService";
import { DefaultApduReceiverService } from "./DefaultApduReceiverService";

export const defaultApduReceiverServiceStubBuilder = (
  props: Partial<ApduReceiverConstructorArgs> = {},
  loggerFactory: (tag: string) => LoggerPublisherService,
): ApduReceiverService =>
  new DefaultApduReceiverService(
    {
      channel: Maybe.of(new Uint8Array([0x12, 0x34])),
      ...props,
    },
    loggerFactory,
  );
