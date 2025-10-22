import { type ContextModule } from "@ledgerhq/context-module";
import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { SignerEthBuilder } from "@api/SignerEthBuilder";
import { DefaultSignerEth } from "@internal/DefaultSignerEth";
import { externalTypes } from "@internal/externalTypes";

describe("SignerEthBuilder", () => {
  const dmk: DeviceManagementKit = {} as DeviceManagementKit;
  const defaultConstructorArgs = { dmk, sessionId: "", originToken: "test" };

  test("should be an instance of SignerEth", () => {
    // GIVEN
    const builder = new SignerEthBuilder(defaultConstructorArgs);

    // WHEN
    builder.build();

    // THEN
    expect(builder).toBeInstanceOf(SignerEthBuilder);
  });

  test("should instanciate with default context module", () => {
    // GIVEN
    const builder = new SignerEthBuilder(defaultConstructorArgs);

    // WHEN
    const signer = builder.build();
    const contextModule = signer["_container"].get<ContextModule>(
      externalTypes.ContextModule,
    );

    // THEN
    expect(signer).toBeInstanceOf(DefaultSignerEth);
    expect(contextModule).toBeDefined();
  });

  test("should instanciate with custom context module", () => {
    // GIVEN
    const builder = new SignerEthBuilder(defaultConstructorArgs);
    const contextModule = {} as ContextModule;

    // WHEN
    const signer = builder.withContextModule(contextModule).build();

    // THEN
    expect(signer).toBeInstanceOf(DefaultSignerEth);
    expect(
      signer["_container"].get<ContextModule>(externalTypes.ContextModule),
    ).toBe(contextModule);
  });
});
