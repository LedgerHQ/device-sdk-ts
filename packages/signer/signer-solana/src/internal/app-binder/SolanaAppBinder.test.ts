import { DeviceSdk, DeviceSessionId } from "@ledgerhq/device-management-kit";

import { SolanaAppBinder } from "./SolanaAppBinder";

describe("SolanaAppBinder", () => {
  it("should be defined", () => {
    const binder = new SolanaAppBinder({} as DeviceSdk, {} as DeviceSessionId);
    expect(binder).toBeDefined();
  });
});
