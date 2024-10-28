import { DeviceSdk, DeviceSessionId } from "@ledgerhq/device-management-kit";

import { DefaultSignerSolana } from "./DefaultSignerSolana";

describe("DefaultSignerSolana", () => {
  it("should be defined", () => {
    const signer = new DefaultSignerSolana({
      sdk: {} as DeviceSdk,
      sessionId: {} as DeviceSessionId,
    });
    expect(signer).toBeDefined();
  });
});
