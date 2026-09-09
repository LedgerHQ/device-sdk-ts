import { describe, expect, it } from "vitest";

import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import {
  type TestResult,
  type TestStatus,
} from "@root/src/domain/types/TestStatus";

import { ResultFormatter } from "./ResultFormatter";

const CONFIG = { title: "T", summaryTitle: "S" };

function result(
  status: TestStatus,
  input: Partial<TransactionInput> = {},
): TestResult {
  return {
    input: {
      kind: SignableInputKind.Transaction,
      rawTx: "0x00",
      description: "case",
      ...input,
    },
    status,
    timestamp: "now",
  };
}

const exitCode = (results: TestResult[]) =>
  ResultFormatter.formatBatchResults(results, results.length, CONFIG).exitCode;

describe("ResultFormatter.formatBatchResults", () => {
  it("passes a clear-signed case", () => {
    expect(exitCode([result("clear_signed")])).toBe(0);
  });

  it.each<TestStatus>(["blind_signed", "partially_clear_signed", "error"])(
    "fails a %s case that expected clear signing",
    (status) => {
      expect(exitCode([result(status)])).toBe(1);
    },
  );

  it("passes a case that expected blind signing and got it", () => {
    expect(
      exitCode([result("blind_signed", { expectBlindSigned: true })]),
    ).toBe(0);
  });

  it.each<TestStatus>(["clear_signed", "partially_clear_signed", "error"])(
    "fails a %s case that expected blind signing",
    (status) => {
      expect(exitCode([result(status, { expectBlindSigned: true })])).toBe(1);
    },
  );

  it("counts a case that produced no result at all as a failure", () => {
    const batch = ResultFormatter.formatBatchResults(
      [result("clear_signed")],
      3,
      CONFIG,
    );
    expect(batch.exitCode).toBe(2);
  });

  it("still reports a blind signature in the counts when it was expected", () => {
    const batch = ResultFormatter.formatBatchResults(
      [result("blind_signed", { expectBlindSigned: true })],
      1,
      CONFIG,
    );
    expect(batch.counts.blindSigned).toBe(1);
    expect(batch.counts.clearSigned).toBe(0);
  });

  it("marks an expected blind signature in the results table", () => {
    const batch = ResultFormatter.formatBatchResults(
      [result("blind_signed", { expectBlindSigned: true })],
      1,
      CONFIG,
    );
    expect(batch.resultsTable[0]!.Status).toContain("(expected)");
  });

  it("does not mark a plain clear signature as expected", () => {
    const batch = ResultFormatter.formatBatchResults(
      [result("clear_signed")],
      1,
      CONFIG,
    );
    expect(batch.resultsTable[0]!.Status).not.toContain("(expected)");
  });
});
