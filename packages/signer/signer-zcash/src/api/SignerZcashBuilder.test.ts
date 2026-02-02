import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { SignerZcashBuilder } from "@api/SignerZcashBuilder";
import { DefaultSignerZcash } from "@internal/DefaultSignerZcash";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

describe("SignerZcashBuilder", () => {
  const dmk: DeviceManagementKit = {
    getLoggerFactory: () => () => mockLogger,
  } as unknown as DeviceManagementKit;
  const defaultConstructorArgs = { dmk, sessionId: "" };

  test("should be an instance of SignerZcashBuilder", () => {
    // GIVEN
    const builder = new SignerZcashBuilder(defaultConstructorArgs);

    // THEN
    expect(builder).toBeInstanceOf(SignerZcashBuilder);
  });

  test("should build a DefaultSignerZcash instance", () => {
    // GIVEN
    const builder = new SignerZcashBuilder(defaultConstructorArgs);

    // WHEN
    const signer = builder.build();

    // THEN
    expect(signer).toBeInstanceOf(DefaultSignerZcash);
  });

  test("should build signer with correct dmk and sessionId", () => {
    // GIVEN
    const sessionId = "test-session-id";
    const builder = new SignerZcashBuilder({ dmk, sessionId });

    // WHEN
    const signer = builder.build();

    // THEN
    expect(signer).toBeInstanceOf(DefaultSignerZcash);
    expect(signer).toBeDefined();
  });
});

