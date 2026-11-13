import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { describe, expect, it, vi } from "vitest";

import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
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

const NO_THREAT = "No threat detected by Transaction Check.";
const RISK = "Potential risk detected.";
const UNAVAILABLE = "Transaction Check unavailable";

const INPUT: TransactionInput = {
  kind: SignableInputKind.Transaction,
  rawTx: "AQAB",
  expectedTexts: ["0.001 SOL"],
  unexpectedTexts: [UNAVAILABLE],
  oneOfTexts: [NO_THREAT, RISK],
};

function handlerWith(analysis: Partial<ScreenTextAnalysis>) {
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
  );

  return { handler, screenAnalyzer };
}

describe("CompleteStateHandler", () => {
  it("checks the case's own expected, unexpected and one-of texts", async () => {
    const { handler, screenAnalyzer } = handlerWith({
      foundOneOf: [NO_THREAT],
    });

    await handler.handle({ input: INPUT });

    expect(screenAnalyzer.analyzeAccumulatedTexts).toHaveBeenCalledWith(
      ["0.001 SOL"],
      [UNAVAILABLE],
      [NO_THREAT, RISK],
    );
  });

  it("requires no one-of text when the case lists none", async () => {
    const { handler, screenAnalyzer } = handlerWith({});

    await handler.handle({
      input: { kind: SignableInputKind.Transaction, rawTx: "AQAB" },
    });

    expect(screenAnalyzer.analyzeAccumulatedTexts).toHaveBeenCalledWith(
      [],
      [],
      [],
    );
  });

  it("gives no reason for a case without one-of texts, as before them", async () => {
    const { handler } = handlerWith({
      containsAll: false,
      missing: ["0.001 SOL"],
    });

    await expect(
      handler.handle({
        input: {
          kind: SignableInputKind.Transaction,
          rawTx: "AQAB",
          expectedTexts: ["0.001 SOL"],
        },
      }),
    ).resolves.toEqual({ status: "partially_clear_signed" });
  });

  it("passes a case whose review met every requirement", async () => {
    const { handler } = handlerWith({ foundOneOf: [NO_THREAT] });

    await expect(handler.handle({ input: INPUT })).resolves.toEqual({
      status: "clear_signed",
    });
  });

  it("names the forbidden text a review showed", async () => {
    const { handler } = handlerWith({
      containsAll: false,
      forbidden: [UNAVAILABLE],
    });

    await expect(handler.handle({ input: INPUT })).resolves.toEqual({
      status: "partially_clear_signed",
      errorMessage: `The review showed "${UNAVAILABLE}", which the case forbids; showed none of "${NO_THREAT}", "${RISK}"`,
    });
  });

  it("names the one-of texts when the review showed none of them", async () => {
    const { handler } = handlerWith({ containsAll: false });

    await expect(handler.handle({ input: INPUT })).resolves.toEqual({
      status: "partially_clear_signed",
      errorMessage: `The review showed none of "${NO_THREAT}", "${RISK}"`,
    });
  });

  it("names only the missing text when one of the alternatives showed", async () => {
    const { handler } = handlerWith({
      containsAll: false,
      missing: ["0.001 SOL"],
      foundOneOf: [RISK],
    });

    await expect(handler.handle({ input: INPUT })).resolves.toEqual({
      status: "partially_clear_signed",
      errorMessage: 'The review never showed "0.001 SOL"',
    });
  });
});
