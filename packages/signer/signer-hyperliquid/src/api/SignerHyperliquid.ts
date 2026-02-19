import { type SignActionsDAReturnType } from "@api/app-binder/SignActionsDeviceActionTypes";
import { type ActionsOptions } from "@api/model/ActionsOptions";

export interface SignerHyperliquid {
  signActions: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: ActionsOptions,
  ) => SignActionsDAReturnType;
}
