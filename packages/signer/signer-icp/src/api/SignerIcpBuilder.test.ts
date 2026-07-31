import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { SignerIcpBuilder } from "@api/SignerIcpBuilder";
import { DefaultSignerIcp } from "@internal/DefaultSignerIcp";

describe("SignerIcpBuilder", () => {
  it("should build a SignerIcp instance", () => {
    // ARRANGE
    const dmk = {} as DeviceManagementKit;
    const sessionId = "test-session-id";
    const builder = new SignerIcpBuilder({ dmk, sessionId });

    // ACT
    const signer = builder.build();

    // ASSERT
    expect(signer).toBeInstanceOf(DefaultSignerIcp);
  });
});
