import {
  type SignActionsDAInput,
  type SignActionsDAReturnType,
} from "@api/app-binder/SignActionsDeviceActionTypes";

export interface SignerHyperliquid {
  signActions: (params: SignActionsDAInput) => SignActionsDAReturnType;
}
