import {
  type TestResult,
  type TestStatus,
} from "@root/src/domain/types/TestStatus";

/** Status counts for batch operations. */
export type StatusCounts = {
  readonly clearSigned: number;
  readonly blindSigned: number;
  readonly partiallyClearSigned: number;
  readonly error: number;
};

/** A case that did not produce the outcome it asked for. */
export type FailedCase = {
  readonly description: string;
  readonly status: TestStatus;
  readonly errorMessage?: string;
  /** Transaction signature, for a case pulled from a live RPC. */
  readonly hash?: string;
};

/** What one batch of cases produced. */
export type BatchTestResult = {
  /** Cases that did not produce their expected outcome. */
  readonly exitCode: number;
  readonly counts: StatusCounts;
  /**
   * The failing cases themselves. A run spreads over many emulators, so naming
   * them is the only way to tell which case failed from the summary.
   */
  readonly failedCases: readonly FailedCase[];
};

export class ResultFormatter {
  /** Count statuses from test results. */
  static countStatuses(results: readonly TestResult[]): StatusCounts {
    const counts = {
      clearSigned: 0,
      blindSigned: 0,
      partiallyClearSigned: 0,
      error: 0,
    };

    for (const result of results) {
      switch (result.status) {
        case "clear_signed":
          counts.clearSigned++;
          break;
        case "blind_signed":
          counts.blindSigned++;
          break;
        case "partially_clear_signed":
          counts.partiallyClearSigned++;
          break;
        case "error":
          counts.error++;
          break;
      }
    }

    return counts;
  }

  /**
   * Reduce a batch of results to its verdict.
   *
   * `totalItems` is what the batch set out to run, so a case that produced no
   * result at all — a crash mid-batch — still counts against the exit code.
   */
  static formatBatchResults(
    results: readonly TestResult[],
    totalItems: number,
  ): BatchTestResult {
    const failedCases = results
      .filter((result) => !this.isAsExpected(result))
      .map((result) => ({
        description: result.input.description || "No description",
        status: result.status,
        ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
        ...(result.hash ? { hash: result.hash } : {}),
      }));

    return {
      exitCode: totalItems - (results.length - failedCases.length),
      counts: this.countStatuses(results),
      failedCases,
    };
  }

  /**
   * Whether a result is the outcome its case asked for.
   *
   * Clear signing is the expectation everywhere except a case that declares
   * `expectBlindSigned`, which exists to prove the blind-signing fallback is
   * still detected and so passes only when the device blind-signs.
   */
  private static isAsExpected(result: TestResult): boolean {
    const expectsBlind =
      "expectBlindSigned" in result.input &&
      result.input.expectBlindSigned === true;
    return result.status === (expectsBlind ? "blind_signed" : "clear_signed");
  }

  /** Get emoji for signing status. */
  static getStatusEmoji(status: TestStatus): string {
    switch (status) {
      case "clear_signed":
        return "✅";
      case "partially_clear_signed":
        return "⚠️";
      case "blind_signed":
        return "🙈";
      case "error":
        return "❌";
      default:
        return "❓";
    }
  }
}
