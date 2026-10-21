import {
  CallTaskInAppDeviceAction,
  CommandResultFactory,
  type InternalApi,
  type LoggerPublisherService,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Just } from "purify-ts";

import { Curve } from "@api/model/Curve";
import { type SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { APP_NAME } from "@internal/app-binder/constants";

import { SignTransactionDeviceActionFactory } from "./SignTransactionDeviceActionFactory";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    CallTaskInAppDeviceAction: vi.fn(),
  };
});

const loggerFactory = () =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    subscribers: [],
  }) as unknown as LoggerPublisherService;

type TaskInput = {
  task: (internalApi: InternalApi) => Promise<unknown>;
};

describe("SignTransactionDeviceActionFactory", () => {
  const defaultArgs = {
    derivationPath: "44'/144'/0'/0/0",
    transaction: Uint8Array.from([0x12, 0x00, 0x00]),
    skipOpenApp: false,
    loggerFactory,
  };

  /** Run the task the factory built and return the Sign APDUs it sent. */
  const runBuiltTask = async () => {
    const { input } = vi.mocked(CallTaskInAppDeviceAction).mock
      .calls[0]![0] as unknown as { input: TaskInput };
    const sendCommand = vi
      .fn()
      .mockResolvedValue(
        CommandResultFactory({ data: Just(Uint8Array.from([0x30, 0x44])) }),
      );

    await input.task({ sendCommand } as unknown as InternalApi);

    return sendCommand.mock.calls.map(([command]) =>
      (command as SignTransactionCommand).getApdu().getRawApdu(),
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should ask for a sign-transaction interaction in the XRP app", () => {
    SignTransactionDeviceActionFactory(defaultArgs);

    expect(CallTaskInAppDeviceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        input: expect.objectContaining({
          appName: APP_NAME,
          requiredUserInteraction: UserInteractionRequired.SignTransaction,
          skipOpenApp: false,
        }),
      }),
    );
  });

  it("should forward skipOpenApp to the device action", () => {
    SignTransactionDeviceActionFactory({ ...defaultArgs, skipOpenApp: true });

    expect(CallTaskInAppDeviceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        input: expect.objectContaining({ skipOpenApp: true }),
      }),
    );
  });

  it("should sign with secp256k1 when no curve is given", async () => {
    SignTransactionDeviceActionFactory(defaultArgs);

    const apdus = await runBuiltTask();

    expect(apdus).toHaveLength(1);
    expect(apdus[0]![3]).toBe(0x40);
  });

  it("should pass the curve through to the Sign APDU", async () => {
    SignTransactionDeviceActionFactory({
      ...defaultArgs,
      curve: Curve.Ed25519,
    });

    const apdus = await runBuiltTask();

    expect(apdus).toHaveLength(1);
    expect(apdus[0]![3]).toBe(0x80);
  });
});
