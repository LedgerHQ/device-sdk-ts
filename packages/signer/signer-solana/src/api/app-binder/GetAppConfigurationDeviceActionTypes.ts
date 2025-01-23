import {
  type ExecuteDeviceActionReturnType,
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type AppConfiguration } from "@api/model/AppConfiguration";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

export type GetAppConfigurationDAOutput =
  SendCommandInAppDAOutput<AppConfiguration>;

export type GetAppConfigurationDAError =
  SendCommandInAppDAError<SolanaAppErrorCodes>;

export type GetAppConfigurationDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<UserInteractionRequired.None>;

export type GetAppConfigurationDAReturnType = ExecuteDeviceActionReturnType<
  GetAppConfigurationDAOutput,
  GetAppConfigurationDAError,
  GetAppConfigurationDAIntermediateValue
>;
