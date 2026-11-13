import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type RetryService } from "@root/src/domain/services/RetryService";
import { type ScreenAnalyzerService } from "@root/src/domain/services/ScreenAnalyzer";

import { OptInStateHandler } from "./OptInStateHandler";
import { type StateHandlerResult } from "./StateHandler";

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as LoggerPublisherService;

const INPUT: TransactionInput = {
  kind: SignableInputKind.Transaction,
  rawTx: "AQAB",
};

// Polls without waiting: each attempt checks once, and running out throws, as
// DefaultRetryService does.
const retryService = {
  pollUntil: async (check: () => Promise<boolean>, maxAttempts: number) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (await check()) return;
    }
    throw new Error("condition not met");
  },
} as unknown as RetryService;

function handlerWith(screens: { modalShows: boolean; optInShown: boolean[] }) {
  const isTransactionCheckOptInShown = vi.fn().mockResolvedValue(true);
  for (const shown of screens.optInShown) {
    isTransactionCheckOptInShown.mockResolvedValueOnce(shown);
  }
  const screenAnalyzer = {
    isWeb3ChecksOptInScreen: vi.fn().mockResolvedValue(screens.modalShows),
    isTransactionCheckOptInShown,
  } as unknown as ScreenAnalyzerService;
  const deviceController = {
    acceptTransactionCheck: vi.fn(),
    rejectTransactionCheck: vi.fn(),
  } as unknown as DeviceController;

  const handler = new OptInStateHandler(
    () => logger,
    deviceController,
    { save: vi.fn() } as unknown as ScreenshotSaver,
    screenAnalyzer,
    retryService,
    "none",
  );

  return { handler, deviceController, isTransactionCheckOptInShown };
}

async function handle(handler: OptInStateHandler): Promise<StateHandlerResult> {
  const result = handler.handle({ input: INPUT });
  // Lets the settle delay before the tap elapse.
  await vi.runAllTimersAsync();
  return result;
}

describe("OptInStateHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts the opt-in, then waits for its confirmation to close", async () => {
    const { handler, deviceController, isTransactionCheckOptInShown } =
      handlerWith({ modalShows: true, optInShown: [true, true, false] });

    await expect(handle(handler)).resolves.toEqual({ status: "ongoing" });

    expect(deviceController.acceptTransactionCheck).toHaveBeenCalledTimes(1);
    expect(deviceController.rejectTransactionCheck).not.toHaveBeenCalled();
    expect(isTransactionCheckOptInShown).toHaveBeenCalledTimes(3);
  });

  it("fails when the opt-in is still on screen after accepting it", async () => {
    const { handler } = handlerWith({ modalShows: true, optInShown: [] });

    await expect(handle(handler)).resolves.toEqual({
      status: "error",
      errorMessage:
        "The Transaction Check opt-in was still on screen after accepting it",
    });
  });

  it("taps nothing when the modal never renders", async () => {
    const { handler, deviceController } = handlerWith({
      modalShows: false,
      optInShown: [],
    });

    await expect(handle(handler)).resolves.toEqual({ status: "ongoing" });

    expect(deviceController.acceptTransactionCheck).not.toHaveBeenCalled();
  });
});
