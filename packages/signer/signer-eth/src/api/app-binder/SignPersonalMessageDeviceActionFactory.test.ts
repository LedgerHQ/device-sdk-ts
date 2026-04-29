import {
  CallTaskInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { APP_NAME } from "@internal/app-binder/constants";

import { SignPersonalMessageDeviceActionFactory } from "./SignPersonalMessageDeviceActionFactory";

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

describe("SignPersonalMessageDeviceActionFactory", () => {
  const defaultArgs = {
    derivationPath: "44'/60'/0'/0/0",
    message: "Hello, world!" as string | Uint8Array,
    skipOpenApp: false,
    loggerFactory: mockLoggerFactory,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { desc: "a string message", message: "Hello, world!" },
    {
      desc: "a Uint8Array message",
      message: new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]),
    },
  ])("should create a CallTaskInAppDeviceAction for $desc", ({ message }) => {
    SignPersonalMessageDeviceActionFactory({ ...defaultArgs, message });

    expect(CallTaskInAppDeviceAction).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      input: expect.objectContaining({
        appName: APP_NAME,
        requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        task: expect.any(Function),
      }),
    });
  });

  it("should forward skipOpenApp to the device action", () => {
    SignPersonalMessageDeviceActionFactory({
      ...defaultArgs,
      skipOpenApp: true,
    });

    expect(CallTaskInAppDeviceAction).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      input: expect.objectContaining({
        skipOpenApp: true,
      }),
    });
  });
});
