import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { SignerCosmosBuilder } from "@api/SignerCosmosBuilder";
import { DefaultSignerCosmos } from "@internal/DefaultSignerCosmos";

describe("SignerCosmosBuilder", () => {
  it("should build a SignerCosmos instance", () => {
    //ARRANGE
    const dmk = {} as DeviceManagementKit;
    const sessionId = "test-session-id";
    const builder = new SignerCosmosBuilder({ dmk, sessionId });

    //ACT
    const signer = builder.build();

    //ASSERT
    expect(signer).toBeInstanceOf(DefaultSignerCosmos);
  });
});
