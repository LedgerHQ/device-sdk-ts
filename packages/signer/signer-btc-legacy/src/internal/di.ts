import {
  type DeviceManagementKit,
  type DeviceSessionId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import { btcLegacyModuleFactory } from "@internal/btcLegacyModule";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";

type MakeContainerProps<ErrorCodes extends string> = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  profile: LegacyCoinProfile<ErrorCodes>;
};

export const makeContainer = <ErrorCodes extends string>({
  dmk,
  sessionId,
  profile,
}: MakeContainerProps<ErrorCodes>) => {
  const container = new Container();

  container.bind<DeviceManagementKit>(btcLegacyTypes.Dmk).toConstantValue(dmk);
  container
    .bind<DeviceSessionId>(btcLegacyTypes.SessionId)
    .toConstantValue(sessionId);
  container
    .bind<LegacyCoinProfile<ErrorCodes>>(btcLegacyTypes.Profile)
    .toConstantValue(profile);
  container
    .bind<
      (tag: string) => LoggerPublisherService
    >(btcLegacyTypes.DmkLoggerFactory)
    .toConstantValue((tag: string) =>
      dmk.getLoggerFactory()(["SignerBtcLegacy", tag]),
    );

  container.loadSync(btcLegacyModuleFactory());

  return container;
};
