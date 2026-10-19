import {
  CallTaskInAppDeviceAction,
  type InternalApi,
  type LoggerPublisherService,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { APP_NAME } from "@internal/app-binder/constants";
import { SendSignTransactionTask } from "@internal/app-binder/task/SendSignTransactionTask";

import { SignTransactionDeviceActionFactory } from "./SignTransactionDeviceActionFactory";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    CallTaskInAppDeviceAction: vi.fn(),
  };
});

vi.mock("@internal/app-binder/task/SendSignTransactionTask", () => ({
  SendSignTransactionTask: vi.fn(),
}));

type FactoryInput = {
  task: (internalApi: InternalApi) => Promise<unknown>;
  appName: string;
  requiredUserInteraction: UserInteractionRequired;
  skipOpenApp: boolean;
};

describe("SignTransactionDeviceActionFactory", () => {
  const transaction = new Uint8Array([0x12, 0x00, 0x00]);
  const internalApi = {} as InternalApi;
  const loggerFactory = (_tag: string) =>
    ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }) as unknown as LoggerPublisherService;
  const defaultArgs = {
    derivationPath: "44'/144'/0'/0/0",
    transaction,
    skipOpenApp: false,
    loggerFactory,
  };
  const run = vi.fn();

  const getInput = (): FactoryInput =>
    (
      vi.mocked(CallTaskInAppDeviceAction).mock.calls[0]![0] as unknown as {
        input: FactoryInput;
      }
    ).input;

  beforeEach(() => {
    vi.clearAllMocks();
    run.mockResolvedValue(undefined);
    vi.mocked(SendSignTransactionTask).mockImplementation(
      () => ({ run }) as unknown as SendSignTransactionTask,
    );
  });

  it("should build the device action on the XRP app with a sign interaction", () => {
    SignTransactionDeviceActionFactory({ ...defaultArgs, skipOpenApp: true });

    expect(getInput()).toEqual(
      expect.objectContaining({
        appName: APP_NAME,
        requiredUserInteraction: UserInteractionRequired.SignTransaction,
        skipOpenApp: true,
      }),
    );
  });

  it("should run the sign task with the given transaction", async () => {
    SignTransactionDeviceActionFactory(defaultArgs);

    await getInput().task(internalApi);

    expect(SendSignTransactionTask).toHaveBeenCalledWith(internalApi, {
      derivationPath: defaultArgs.derivationPath,
      serializedTransaction: transaction,
      loggerFactory,
    });
    expect(run).toHaveBeenCalledOnce();
  });

  it("should read a lazy transaction when the task runs, not when the device action is built", async () => {
    const getTransaction = vi.fn(() => transaction);

    SignTransactionDeviceActionFactory({
      ...defaultArgs,
      transaction: getTransaction,
    });

    expect(getTransaction).not.toHaveBeenCalled();

    await getInput().task(internalApi);

    expect(getTransaction).toHaveBeenCalledOnce();
    expect(SendSignTransactionTask).toHaveBeenCalledWith(
      internalApi,
      expect.objectContaining({ serializedTransaction: transaction }),
    );
  });
});
