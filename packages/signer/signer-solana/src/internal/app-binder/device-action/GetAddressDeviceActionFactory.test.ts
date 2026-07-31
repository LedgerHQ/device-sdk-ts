import {
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { GetPubKeyCommand } from "@internal/app-binder/command/GetPubKeyCommand";
import { APP_NAME } from "@internal/app-binder/constants";

import { GetAddressDeviceActionFactory } from "./GetAddressDeviceActionFactory";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    SendCommandInAppDeviceAction: vi.fn(),
  };
});

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

describe("GetAddressDeviceActionFactory", () => {
  const defaultArgs = {
    derivationPath: "44'/501'/0'/0'",
    checkOnDevice: false,
    skipOpenApp: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      desc: "checkOnDevice is false",
      overrides: { checkOnDevice: false },
      expectedInteraction: UserInteractionRequired.None,
    },
    {
      desc: "checkOnDevice is true",
      overrides: { checkOnDevice: true },
      expectedInteraction: UserInteractionRequired.VerifyAddress,
    },
  ])(
    "should use $expectedInteraction interaction when $desc",
    ({ overrides, expectedInteraction }) => {
      GetAddressDeviceActionFactory({ ...defaultArgs, ...overrides });

      expect(SendCommandInAppDeviceAction).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        input: expect.objectContaining({
          appName: APP_NAME,
          requiredUserInteraction: expectedInteraction,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          command: expect.any(GetPubKeyCommand),
        }),
        logger: undefined,
      });
    },
  );

  it("should forward skipOpenApp and logger to the device action", () => {
    GetAddressDeviceActionFactory({
      ...defaultArgs,
      skipOpenApp: true,
      logger: mockLogger,
    });

    expect(SendCommandInAppDeviceAction).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      input: expect.objectContaining({
        skipOpenApp: true,
      }),
      logger: mockLogger,
    });
  });
});
