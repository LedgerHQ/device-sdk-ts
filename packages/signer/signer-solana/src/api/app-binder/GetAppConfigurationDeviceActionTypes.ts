import {
  type ExecuteDeviceActionReturnType,
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { AppConfiguration } from "@api/model/AppConfiguration";

type GetAppConfigurationDAUserInteractionRequired =
  UserInteractionRequired.None;

export type GetAppConfigurationDAOutput =
  SendCommandInAppDAOutput<AppConfiguration>;
export type GetAppConfigurationDAError = SendCommandInAppDAError<never>;
export type GetAppConfigurationDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetAppConfigurationDAUserInteractionRequired>;

export type GetAppConfigurationDAReturnType = ExecuteDeviceActionReturnType<
  GetAppConfigurationDAOutput,
  GetAppConfigurationDAError,
  GetAppConfigurationDAIntermediateValue
>;
