import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { SignerBtcBuilder } from "@api/SignerBtcBuilder";

describe("SignerBtcBuilder", () => {
  const dmk: DeviceManagementKit = {} as DeviceManagementKit;

  test("should be an instance of SignerBtc", () => {
    // GIVEN
    const builder = new SignerBtcBuilder({ dmk, sessionId: "" });

    // WHEN
    builder.build();

    // THEN
    expect(builder).toBeInstanceOf(SignerBtcBuilder);
  });
});
