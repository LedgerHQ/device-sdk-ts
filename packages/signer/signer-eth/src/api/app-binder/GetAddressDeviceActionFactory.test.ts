import { type ContextModule } from "@ledgerhq/context-module";
import {
  CallTaskInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { APP_NAME } from "@internal/app-binder/constants";

import { GetAddressDeviceActionFactory } from "./GetAddressDeviceActionFactory";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    CallTaskInAppDeviceAction: vi.fn(),
  };
});

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("GetAddressDeviceActionFactory", () => {
  const defaultArgs = {
    derivationPath: "44'/60'/0'/0/0",
    checkOnDevice: false,
    returnChainCode: false,
    skipOpenApp: false,
    contextModule: {} as ContextModule,
    loggerFactory: mockLoggerFactory,
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

      expect(CallTaskInAppDeviceAction).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        input: expect.objectContaining({
          appName: APP_NAME,
          requiredUserInteraction: expectedInteraction,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          task: expect.any(Function),
        }),
      });
    },
  );

  it("should forward skipOpenApp to the device action", () => {
    GetAddressDeviceActionFactory({ ...defaultArgs, skipOpenApp: true });

    expect(CallTaskInAppDeviceAction).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      input: expect.objectContaining({
        skipOpenApp: true,
      }),
    });
  });

  it("should accept an optional chainId", () => {
    GetAddressDeviceActionFactory({ ...defaultArgs, chainId: 1 });

    expect(CallTaskInAppDeviceAction).toHaveBeenCalledTimes(1);
  });
});
