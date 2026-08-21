import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { SignerXrpBuilder } from "@api/SignerXrpBuilder";
import { DefaultSignerXrp } from "@internal/DefaultSignerXrp";

describe("SignerXrpBuilder", () => {
  it("should build a SignerXrp instance", () => {
    // ARRANGE
    const dmk = {} as DeviceManagementKit;
    const sessionId = "test-session-id";
    const builder = new SignerXrpBuilder({ dmk, sessionId });

    // ACT
    const signer = builder.build();

    // ASSERT
    expect(signer).toBeInstanceOf(DefaultSignerXrp);
  });
});
