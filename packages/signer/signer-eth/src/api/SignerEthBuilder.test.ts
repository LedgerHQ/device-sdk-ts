import {
  type ContextLoader,
  type ContextModule,
} from "@ledgerhq/context-module";
import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { SignerEthBuilder } from "@api/SignerEthBuilder";

describe("SignerEthBuilder", () => {
  const dmk: DeviceManagementKit = {} as DeviceManagementKit;

  test("should be an instance of SignerEth", () => {
    // GIVEN
    const builder = new SignerEthBuilder({ dmk, sessionId: "" });

    // WHEN
    builder.build();

    // THEN
    expect(builder).toBeInstanceOf(SignerEthBuilder);
  });

  test("should instanciate with default context module", () => {
    // GIVEN
    const builder = new SignerEthBuilder({ dmk, sessionId: "" });

    // WHEN
    builder.build();

    // THEN
    expect(builder["_contextModule"]).toBeDefined();
    expect(
      (builder["_contextModule"] as unknown as { _loaders: ContextLoader[] })
        ._loaders,
    ).toHaveLength(4);
  });

  test("should instanciate with custom context module", () => {
    // GIVEN
    const builder = new SignerEthBuilder({ dmk, sessionId: "" });
    const contextModule = {} as ContextModule;

    // WHEN
    builder.withContextModule(contextModule).build();

    // THEN
    expect(builder["_contextModule"]).toBe(contextModule);
  });
});
