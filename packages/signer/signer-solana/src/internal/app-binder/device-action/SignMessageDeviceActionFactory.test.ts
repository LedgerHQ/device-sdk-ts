import {
  CallTaskInAppDeviceAction,
  type InternalApi,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { SignMessageVersion } from "@api/model/MessageOptions";
import { APP_NAME } from "@internal/app-binder/constants";
import { SendSignMessageTask } from "@internal/app-binder/task/SendSignMessageTask";

import { SignMessageDeviceActionFactory } from "./SignMessageDeviceActionFactory";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    CallTaskInAppDeviceAction: vi.fn(),
  };
});

vi.mock("@internal/app-binder/task/SendSignMessageTask", () => ({
  SendSignMessageTask: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({ data: { signature: "sig" } }),
  })),
}));

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

describe("SignMessageDeviceActionFactory", () => {
  const defaultArgs = {
    derivationPath: "44'/501'/0'/0'",
    message: "Hello, world!" as string | Uint8Array,
    skipOpenApp: false,
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
    SignMessageDeviceActionFactory({ ...defaultArgs, message });

    expect(CallTaskInAppDeviceAction).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      input: expect.objectContaining({
        appName: APP_NAME,
        requiredUserInteraction: UserInteractionRequired.SignPersonalMessage,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        task: expect.any(Function),
      }),
      logger: undefined,
    });
  });

  it("should forward skipOpenApp and logger to the device action", () => {
    SignMessageDeviceActionFactory({
      ...defaultArgs,
      skipOpenApp: true,
      logger: mockLogger,
    });

    expect(CallTaskInAppDeviceAction).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      input: expect.objectContaining({
        skipOpenApp: true,
      }),
      logger: mockLogger,
    });
  });

  it("should build the task with the forwarded args", async () => {
    const signers = [new Uint8Array(32)];
    SignMessageDeviceActionFactory({
      ...defaultArgs,
      message: "signed",
      version: SignMessageVersion.V1,
      appDomain: "example.com",
      signers,
    });

    const { task } = vi.mocked(CallTaskInAppDeviceAction).mock.calls[0]![0]
      .input;
    await task({} as InternalApi);

    expect(SendSignMessageTask).toHaveBeenCalledWith(expect.anything(), {
      derivationPath: defaultArgs.derivationPath,
      sendingData: "signed",
      version: SignMessageVersion.V1,
      appDomain: "example.com",
      signers,
    });
  });
});
