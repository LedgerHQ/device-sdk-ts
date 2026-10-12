import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { SignerHederaBuilder } from "@api/SignerHederaBuilder";
import { DefaultSignerHedera } from "@internal/DefaultSignerHedera";

describe("SignerHederaBuilder", () => {
  it("should build a SignerHedera instance", () => {
    // ARRANGE
    const dmk = {} as DeviceManagementKit;
    const sessionId = "test-session-id";
    const builder = new SignerHederaBuilder({ dmk, sessionId });

    // ACT
    const signer = builder.build();

    // ASSERT
    expect(signer).toBeInstanceOf(DefaultSignerHedera);
  });
});
