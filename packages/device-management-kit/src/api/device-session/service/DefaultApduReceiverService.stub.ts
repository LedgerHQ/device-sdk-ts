import { Maybe } from "purify-ts";

import { type ApduReceiverService } from "@api/device-session/service/ApduReceiverService";
import { type ApduReceiverConstructorArgs } from "@api/device-session/service/ApduReceiverService";
import { DefaultApduReceiverService } from "@internal/device-session/service/DefaultApduReceiverService";

export const defaultApduReceiverServiceStubBuilder = (
  props: Partial<ApduReceiverConstructorArgs> = {},
): ApduReceiverService =>
  new DefaultApduReceiverService({
    channel: Maybe.of(new Uint8Array([0x12, 0x34])),
    ...props,
  });
