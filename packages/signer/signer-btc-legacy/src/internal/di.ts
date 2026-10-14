import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import {
  btcLegacyModuleFactory,
  btcLegacyTypes,
  type LegacyCoinProfile,
} from "@ledgerhq/signer-btc-legacy-core";
import { Container } from "inversify";

export const makeContainer = <ErrorCodes extends string>({
  dmk,
  sessionId,
  profile,
}: {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  profile: LegacyCoinProfile<ErrorCodes>;
}) => {
  const container = new Container();
  container.bind(btcLegacyTypes.Dmk).toConstantValue(dmk);
  container.bind(btcLegacyTypes.SessionId).toConstantValue(sessionId);
  container.bind(btcLegacyTypes.Profile).toConstantValue(profile);
  container.loadSync(btcLegacyModuleFactory());
  return container;
};
