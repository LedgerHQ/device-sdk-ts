import { ContainerModule } from "inversify";

import { BtcLegacyAppBinder } from "./BtcLegacyAppBinder";
import { btcLegacyTypes } from "./btcLegacyTypes";

/**
 * The legacy-protocol services. Each signer kit loads this module in its own
 * container, after binding btcLegacyTypes.Dmk, SessionId and Profile.
 */
export const btcLegacyModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(btcLegacyTypes.AppBinder).to(BtcLegacyAppBinder);
  });
