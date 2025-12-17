import {
  type ExecuteDeviceActionReturnType,
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";

type GetMasterFingerprintDARequiredInteraction = UserInteractionRequired.None;

export type GetMasterFingerprintDAOutput = SendCommandInAppDAOutput<{
  masterFingerprint: Uint8Array;
}>;

export type GetMasterFingerprintDAError =
  SendCommandInAppDAError<BtcErrorCodes>;

export type GetMasterFingerprintDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetMasterFingerprintDARequiredInteraction>;

export type GetMasterFingerprintDAInput = {
  skipOpenApp: boolean;
};

export type GetMasterFingerprintDAReturnType = ExecuteDeviceActionReturnType<
  GetMasterFingerprintDAOutput,
  GetMasterFingerprintDAError,
  GetMasterFingerprintDAIntermediateValue
>;
