import { Container } from "inversify";

import { BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";
import { btcLegacyModuleFactory } from "@internal/btcLegacyModule";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";

describe("btcLegacyModuleFactory", () => {
  it("should bind the app binder", () => {
    const container = new Container();
    container.loadSync(btcLegacyModuleFactory());

    expect(container.get(btcLegacyTypes.AppBinder)).toBeInstanceOf(
      BtcLegacyAppBinder,
    );
  });
});
