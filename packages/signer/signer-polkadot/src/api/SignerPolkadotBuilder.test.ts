import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { SignerPolkadotBuilder } from "@api/SignerPolkadotBuilder";
import { APP_NAME, LEDGER_CLA } from "@internal/app-binder/constants";
import { DefaultSignerPolkadot } from "@internal/DefaultSignerPolkadot";

describe("SignerPolkadotBuilder", () => {
  const dmk = {} as DeviceManagementKit;
  const defaultConstructorArgs = { dmk, sessionId: "" };

  test("should be an instance of SignerPolkadotBuilder", () => {
    const builder = new SignerPolkadotBuilder(defaultConstructorArgs);

    expect(builder).toBeInstanceOf(SignerPolkadotBuilder);
  });

  test("should build a DefaultSignerPolkadot", () => {
    const builder = new SignerPolkadotBuilder(defaultConstructorArgs);

    const signer = builder.build();

    expect(signer).toBeInstanceOf(DefaultSignerPolkadot);
  });
});

describe("Polkadot APDU constants", () => {
  test("APP_NAME should be Polkadot", () => {
    expect(APP_NAME).toBe("Polkadot");
  });

  test("LEDGER_CLA should be 0xF9", () => {
    expect(LEDGER_CLA).toBe(0xf9);
  });
});
