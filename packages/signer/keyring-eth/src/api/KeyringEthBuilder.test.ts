import { ContextLoader, ContextModule } from "@ledgerhq/context-module";
import { DeviceSdk } from "@ledgerhq/device-management-kit";

import { KeyringEthBuilder } from "@api/KeyringEthBuilder";

describe("KeyringEthBuilder", () => {
  const sdk: DeviceSdk = {} as DeviceSdk;

  test("should be an instance of KeyringEth", () => {
    // GIVEN
    const builder = new KeyringEthBuilder({ sdk, sessionId: "" });

    // WHEN
    builder.build();

    // THEN
    expect(builder).toBeInstanceOf(KeyringEthBuilder);
  });

  test("should instanciate with default context module", () => {
    // GIVEN
    const builder = new KeyringEthBuilder({ sdk, sessionId: "" });

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
    const builder = new KeyringEthBuilder({ sdk, sessionId: "" });
    const contextModule = {} as ContextModule;

    // WHEN
    builder.withContextModule(contextModule).build();

    // THEN
    expect(builder["_contextModule"]).toBe(contextModule);
  });
});
