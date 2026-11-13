import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { describe, expect, it, vi } from "vitest";

import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import {
  TRANSACTION_CHECK_UNAVAILABLE,
  TRANSACTION_CHECK_VERDICTS,
} from "@root/src/domain/models/TransactionCheck";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type RetryService } from "@root/src/domain/services/RetryService";
import {
  type ScreenAnalyzerService,
  type ScreenTextAnalysis,
} from "@root/src/domain/services/ScreenAnalyzer";

import { CompleteStateHandler } from "./CompleteStateHandler";

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as LoggerPublisherService;

const INPUT: TransactionInput = {
  kind: SignableInputKind.Transaction,
  rawTx: "AQAB",
  expectedTexts: ["0.001 SOL"],
  unexpectedTexts: ["Blind signing ahead"],
};

const NO_THREAT = TRANSACTION_CHECK_VERDICTS[0]!;

function handlerWith(
  transactionCheckEnabled: boolean,
  analysis: Partial<ScreenTextAnalysis>,
) {
  const screenAnalyzer = {
    isHomePage: vi.fn().mockResolvedValue(true),
    canRefuseTransaction: vi.fn().mockResolvedValue(false),
    analyzeAccumulatedTexts: vi.fn().mockResolvedValue({
      containsAll: true,
      found: [],
      missing: [],
      forbidden: [],
      foundOneOf: [],
      ...analysis,
    }),
  } as unknown as ScreenAnalyzerService;
  const retryService = {
    pollUntil: vi.fn().mockResolvedValue(undefined),
  } as unknown as RetryService;

  const handler = new CompleteStateHandler(
    () => logger,
    screenAnalyzer,
    retryService,
    {} as DeviceController,
    { save: vi.fn() } as unknown as ScreenshotSaver,
    { originToken: "", blindSigningEnabled: false, transactionCheckEnabled },
  );

  return { handler, screenAnalyzer };
}

describe("CompleteStateHandler", () => {
  it("asks for a verdict and forbids the unavailable line when Transaction Check is on", async () => {
    const { handler, screenAnalyzer } = handlerWith(true, {
      foundOneOf: [NO_THREAT],
    });

    await handler.handle({ input: INPUT });

    expect(screenAnalyzer.analyzeAccumulatedTexts).toHaveBeenCalledWith(
      ["0.001 SOL"],
      ["Blind signing ahead", TRANSACTION_CHECK_UNAVAILABLE],
      TRANSACTION_CHECK_VERDICTS,
    );
  });

  it("asks for neither when Transaction Check is off", async () => {
    const { handler, screenAnalyzer } = handlerWith(false, {});

    await handler.handle({ input: INPUT });

    expect(screenAnalyzer.analyzeAccumulatedTexts).toHaveBeenCalledWith(
      ["0.001 SOL"],
      ["Blind signing ahead"],
      [],
    );
  });

  it("passes a case whose review showed a verdict", async () => {
    const { handler } = handlerWith(true, { foundOneOf: [NO_THREAT] });

    await expect(handler.handle({ input: INPUT })).resolves.toEqual({
      status: "clear_signed",
    });
  });

  it("fails a case whose review said no report reached the device", async () => {
    const { handler } = handlerWith(true, {
      containsAll: false,
      forbidden: [TRANSACTION_CHECK_UNAVAILABLE],
    });

    const result = await handler.handle({ input: INPUT });

    expect(result.status).toBe("partially_clear_signed");
    expect(result.errorMessage).toContain(TRANSACTION_CHECK_UNAVAILABLE);
  });

  it("fails a case whose review showed no verdict at all", async () => {
    const { handler } = handlerWith(true, { containsAll: false });

    await expect(handler.handle({ input: INPUT })).resolves.toEqual({
      status: "partially_clear_signed",
      errorMessage: "The review showed no Transaction Check verdict",
    });
  });

  it("blames no verdict when the verdict showed but an expected text did not", async () => {
    const { handler } = handlerWith(true, {
      containsAll: false,
      missing: ["0.001 SOL"],
      foundOneOf: [NO_THREAT],
    });

    await expect(handler.handle({ input: INPUT })).resolves.toEqual({
      status: "partially_clear_signed",
    });
  });
});
