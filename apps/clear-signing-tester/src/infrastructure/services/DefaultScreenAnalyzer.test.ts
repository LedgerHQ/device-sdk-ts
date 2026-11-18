import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { describe, expect, it, vi } from "vitest";

import { type ScreenReader } from "@root/src/domain/adapters/ScreenReader";
import { type ScreenEvent } from "@root/src/domain/models/ScreenContent";

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

    // Otherwise the wait for the opt-in to close would end on its first poll.
    it("is true on a screen that reads empty", async () => {
      await expect(
        analyzerShowing([]).isTransactionCheckOptInShown(),
      ).resolves.toBe(true);
    });

    it("is true when the screen cannot be read", async () => {
      const reader: ScreenReader = {
        readRawScreenEvents: vi.fn().mockRejectedValue(new Error("timeout")),
      };

      await expect(
        new DefaultScreenAnalyzer(
          reader,
          () => logger,
        ).isTransactionCheckOptInShown(),
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

  // A warning's heading and its "Detected by Transaction_Checks" run together
  // into "potential risk detected…" once whitespace is stripped, so only the
  // verdict's trailing period keeps a warning from passing for the verdict.
  describe("analyzeAccumulatedTexts with a Transaction Check verdict", () => {
    it.each([
      ["risk", RISK_WARNING, "Potential risk detected."],
      ["threat", THREAT_WARNING, "Critical threat detected."],
    ])(
      "fails when a %s warning precedes a review without its verdict",
      async (_label, warning, verdict) => {
        const analyzer = analyzerShowing(warning, REVIEW_WITHOUT_VERDICT);
        await analyzer.isHomePage();
        await analyzer.isHomePage();

        const analysis = await analyzer.analyzeAccumulatedTexts([verdict]);

        expect(analysis.containsAll).toBe(false);
        expect(analysis.missing).toEqual([verdict]);
      },
    );

    it("passes on the verdict line of the review that follows a warning", async () => {
      const analyzer = analyzerShowing(RISK_WARNING, REVIEW_RISK);
      await analyzer.isHomePage();
      await analyzer.isHomePage();

      const analysis = await analyzer.analyzeAccumulatedTexts([
        "Potential risk detected.",
      ]);

      expect(analysis.containsAll).toBe(true);
    });
  });
});
