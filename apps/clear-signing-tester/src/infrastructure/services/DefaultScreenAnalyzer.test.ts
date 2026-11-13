import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { describe, expect, it, vi } from "vitest";

import { type ScreenReader } from "@root/src/domain/adapters/ScreenReader";
import { type ScreenEvent } from "@root/src/domain/models/ScreenContent";
import { TRANSACTION_CHECK_VERDICTS } from "@root/src/domain/models/TransactionCheck";

import { DefaultScreenAnalyzer } from "./DefaultScreenAnalyzer";

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as LoggerPublisherService;

const event = (text: string): ScreenEvent => ({
  text,
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  clear: false,
});

/** An analyzer whose device shows `screens` in turn, one per read. */
function analyzerShowing(...screens: string[][]): DefaultScreenAnalyzer {
  const readRawScreenEvents = vi.fn();
  for (const screen of screens) {
    readRawScreenEvents.mockResolvedValueOnce(screen.map(event));
  }
  const reader: ScreenReader = { readRawScreenEvents };
  return new DefaultScreenAnalyzer(reader, () => logger);
}

// Screens as the Solana app draws them on Stax, from its own test snapshots.
const OPT_IN_MODAL = [
  "Enable\nTransaction Check?",
  "Get real-time warnings about risky Solana transactions.",
  "Yes, enable",
  "Maybe later",
];
const OPT_IN_CONFIRMATION = ["Transaction Check\nenabled"];
const HOME = [
  "Solana",
  "This app enables signing transactions on the Solana network.",
  "Quit app",
];
const REVIEW_NO_THREAT = [
  "Review transaction to\nsend SOL",
  "No threat detected by\nTransaction Check.",
  "Reject",
];
const REVIEW_UNAVAILABLE = [
  "Review transaction to\nsend SOL",
  "Transaction Check unavailable",
  "Reject",
];
const REVIEW_WITHOUT_VERDICT = ["Review transaction to\nsend SOL", "Reject"];
const REVIEW_RISK = [
  "Review transaction to\nsend SOL",
  "Potential risk detected.",
  "Reject",
];
const REVIEW_THREAT = [
  "Review transaction to\nsend SOL",
  "Critical threat detected.",
  "Reject",
];
const RISK_WARNING = [
  "Potential risk",
  "Detected by Transaction_\nChecks",
  "This transaction might be malicious.",
  "Back to safety",
  "Accept risk and continue",
];
const THREAT_WARNING = [
  "Critical threat",
  "Detected by Transaction_\nChecks",
  "This request is malicious.",
  "Back to safety",
  "Accept threat and continue",
];
const BLIND_SIGNING_WARNING = [
  "Blind signing ahead",
  "Back to safety",
  "Accept risk and continue",
];

describe("DefaultScreenAnalyzer", () => {
  describe("isTransactionCheckOptInShown", () => {
    it.each([
      ["its modal", OPT_IN_MODAL],
      ["the confirmation that follows it", OPT_IN_CONFIRMATION],
    ])("is true on %s", async (_label, screen) => {
      await expect(
        analyzerShowing(screen).isTransactionCheckOptInShown(),
      ).resolves.toBe(true);
    });

    // The review's verdict line names Transaction Check too, so matching on
    // that alone would wait on the review forever.
    it.each([
      ["the home page", HOME],
      ["a review with a verdict", REVIEW_NO_THREAT],
      ["a review without one", REVIEW_UNAVAILABLE],
    ])("is false on %s", async (_label, screen) => {
      await expect(
        analyzerShowing(screen).isTransactionCheckOptInShown(),
      ).resolves.toBe(false);
    });
  });

  describe("isTransactionCheckWarning", () => {
    it.each([
      ["the risk warning", RISK_WARNING],
      ["the threat warning", THREAT_WARNING],
    ])("is true on %s", async (_label, screen) => {
      await expect(
        analyzerShowing(screen).isTransactionCheckWarning(),
      ).resolves.toBe(true);
    });

    it.each([
      ["a review that names the risk", REVIEW_RISK],
      ["a review that names the threat", REVIEW_THREAT],
      ["the blind-signing warning", BLIND_SIGNING_WARNING],
    ])("is false on %s", async (_label, screen) => {
      await expect(
        analyzerShowing(screen).isTransactionCheckWarning(),
      ).resolves.toBe(false);
    });
  });

  describe("analyzeAccumulatedTexts with oneOfTexts", () => {
    it("passes when a screen read earlier showed one of them", async () => {
      const analyzer = analyzerShowing(REVIEW_NO_THREAT, HOME);
      await analyzer.isHomePage();
      await analyzer.isHomePage();

      const analysis = await analyzer.analyzeAccumulatedTexts(
        [],
        [],
        TRANSACTION_CHECK_VERDICTS,
      );

      expect(analysis.containsAll).toBe(true);
      expect(analysis.foundOneOf).toEqual([
        "No threat detected by Transaction Check.",
      ]);
    });

    it.each([
      ["risk", RISK_WARNING],
      ["threat", THREAT_WARNING],
    ])(
      "fails when a %s warning precedes a review without a verdict",
      async (_label, warning) => {
        const analyzer = analyzerShowing(warning, REVIEW_WITHOUT_VERDICT);
        await analyzer.isHomePage();
        await analyzer.isHomePage();

        const analysis = await analyzer.analyzeAccumulatedTexts(
          [],
          [],
          TRANSACTION_CHECK_VERDICTS,
        );

        expect(analysis.containsAll).toBe(false);
        expect(analysis.foundOneOf).toEqual([]);
      },
    );

    it("passes on the verdict line of the review that follows a warning", async () => {
      const analyzer = analyzerShowing(RISK_WARNING, REVIEW_RISK);
      await analyzer.isHomePage();
      await analyzer.isHomePage();

      const analysis = await analyzer.analyzeAccumulatedTexts(
        [],
        [],
        TRANSACTION_CHECK_VERDICTS,
      );

      expect(analysis.containsAll).toBe(true);
      expect(analysis.foundOneOf).toEqual(["Potential risk detected."]);
    });

    it("fails when no screen showed any of them", async () => {
      const analyzer = analyzerShowing(REVIEW_UNAVAILABLE);
      await analyzer.isHomePage();

      const analysis = await analyzer.analyzeAccumulatedTexts(
        [],
        [],
        TRANSACTION_CHECK_VERDICTS,
      );

      expect(analysis.containsAll).toBe(false);
      expect(analysis.foundOneOf).toEqual([]);
    });

    it("requires nothing when none are given", async () => {
      const analyzer = analyzerShowing(HOME);
      await analyzer.isHomePage();

      const analysis = await analyzer.analyzeAccumulatedTexts([], []);

      expect(analysis.containsAll).toBe(true);
      expect(analysis.foundOneOf).toEqual([]);
    });
  });
});
