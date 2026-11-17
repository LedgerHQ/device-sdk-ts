import { type SignTransactionDAInput } from "@api/app-binder/SignTransactionDeviceActionTypes";

import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

export const SignTransactionDeviceActionFactory = (args: {
  input: SignTransactionDAInput;
  inspect?: boolean;
}): SignTransactionDeviceAction => new SignTransactionDeviceAction(args);
