import { describe, expect, it } from "vitest";

import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import {
  type TestResult,
  type TestStatus,
} from "@root/src/domain/types/TestStatus";

import { ResultFormatter } from "./ResultFormatter";

function result(
  status: TestStatus,
  input: Partial<TransactionInput> = {},
  extra: Partial<TestResult> = {},
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
    ...extra,
  };
}

const exitCode = (results: TestResult[]) =>
  ResultFormatter.formatBatchResults(results, results.length).exitCode;

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
    expect(
      ResultFormatter.formatBatchResults([result("clear_signed")], 3).exitCode,
    ).toBe(2);
  });

  it("still reports a blind signature in the counts when it was expected", () => {
    const batch = ResultFormatter.formatBatchResults(
      [result("blind_signed", { expectBlindSigned: true })],
      1,
    );
    expect(batch.counts.blindSigned).toBe(1);
    expect(batch.counts.clearSigned).toBe(0);
  });

  it("names each failing case with its status", () => {
    const batch = ResultFormatter.formatBatchResults(
      [
        result("clear_signed", { description: "USDT transfer" }),
        result("blind_signed", { description: "UNISWAP swap" }),
        result("error", { description: "broken" }, { errorMessage: "boom" }),
      ],
      3,
    );
    expect(batch.failedCases).toEqual([
      { description: "UNISWAP swap", status: "blind_signed" },
      { description: "broken", status: "error", errorMessage: "boom" },
    ]);
  });

  it("names no case when every one met its expectation", () => {
    const batch = ResultFormatter.formatBatchResults(
      [
        result("clear_signed"),
        result("blind_signed", { expectBlindSigned: true }),
      ],
      2,
    );
    expect(batch.failedCases).toEqual([]);
    expect(batch.exitCode).toBe(0);
  });

  it("keeps the signature of a failing case pulled from an RPC", () => {
    const batch = ResultFormatter.formatBatchResults(
      [result("error", { description: "live tx" }, { hash: "5xy…" })],
      1,
    );
    expect(batch.failedCases[0]!.hash).toBe("5xy…");
  });
});
