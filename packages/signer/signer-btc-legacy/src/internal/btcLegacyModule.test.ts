import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { LITECOIN_PROFILE } from "@api/profiles/litecoinProfile";
import { BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";
import { btcLegacyModuleFactory } from "@internal/btcLegacyModule";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";
import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";

describe("btcLegacyModuleFactory", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
    container
      .bind(btcLegacyTypes.Dmk)
      .toConstantValue({} as DeviceManagementKit);
    container
      .bind(btcLegacyTypes.SessionId)
      .toConstantValue("session-id" as DeviceSessionId);
    container.bind(btcLegacyTypes.Profile).toConstantValue(LITECOIN_PROFILE);
    container.loadSync(btcLegacyModuleFactory());
  });

  it("should bind the app binder", () => {
    expect(container.get(btcLegacyTypes.AppBinder)).toBeInstanceOf(
      BtcLegacyAppBinder,
    );
  });

  it("should bind the get address use case", () => {
    expect(container.get(btcLegacyTypes.GetAddressUseCase)).toBeInstanceOf(
      GetAddressUseCase,
    );
  });
});
