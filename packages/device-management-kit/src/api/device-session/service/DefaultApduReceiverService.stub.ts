import { Maybe } from "purify-ts";

import { type ApduReceiverService } from "@api/device-session/service/ApduReceiverService";
import { type ApduReceiverConstructorArgs } from "@api/device-session/service/ApduReceiverService";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DefaultApduReceiverService } from "@internal/device-session/service/DefaultApduReceiverService";

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
