import type { LoggerPublisherService } from "@ledgerhq/device-management-kit";

import { type SignTransactionDAInput } from "@api/app-binder/SignTransactionDeviceActionTypes";

import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

export const SignTransactionDeviceActionFactory = (args: {
  input: SignTransactionDAInput;
  inspect?: boolean;
  loggerFactory?: (tag: string) => LoggerPublisherService;
}): SignTransactionDeviceAction => new SignTransactionDeviceAction(args);
