import { Maybe } from "purify-ts";

import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import {
  DefaultApduReceiverConstructorArgs,
  DefaultApduReceiverService,
} from "@internal/device-session/service/DefaultApduReceiverService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

export const defaultApduReceiverServiceStubBuilder = (
  props: Partial<DefaultApduReceiverConstructorArgs> = {},
  loggerFactory: (tag: string) => LoggerPublisherService,
): ApduReceiverService =>
  new DefaultApduReceiverService(
    {
      channel: Maybe.of(new Uint8Array([0x12, 0x34])),
      ...props,
    },
    loggerFactory,
  );
