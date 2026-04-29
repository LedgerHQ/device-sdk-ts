import { type ContextModule } from "@ledgerhq/context-module";
import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { SignerConcordiumBuilder } from "@api/SignerConcordiumBuilder";
import { DefaultSignerConcordium } from "@internal/DefaultSignerConcordium";
import { externalTypes } from "@internal/externalTypes";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

describe("SignerConcordiumBuilder", () => {
  const dmk: DeviceManagementKit = {
    getLoggerFactory: () => () => mockLogger,
  } as unknown as DeviceManagementKit;
  const defaultConstructorArgs = { dmk, sessionId: "" };

  test("should be an instance of SignerConcordiumBuilder", () => {
    const builder = new SignerConcordiumBuilder(defaultConstructorArgs);

    builder.build();

    expect(builder).toBeInstanceOf(SignerConcordiumBuilder);
  });

  test("should instantiate with default context module", () => {
    const builder = new SignerConcordiumBuilder(defaultConstructorArgs);

    const signer = builder.build();
    const contextModule = signer["_container"].get<ContextModule>(
      externalTypes.ContextModule,
    );

    expect(signer).toBeInstanceOf(DefaultSignerConcordium);
    expect(contextModule).toBeDefined();
  });

  test("should instantiate with custom context module", () => {
    const builder = new SignerConcordiumBuilder(defaultConstructorArgs);
    const contextModule = {} as ContextModule;

    const signer = builder.withContextModule(contextModule).build();

    expect(signer).toBeInstanceOf(DefaultSignerConcordium);
    expect(
      signer["_container"].get<ContextModule>(externalTypes.ContextModule),
    ).toBe(contextModule);
  });
});
