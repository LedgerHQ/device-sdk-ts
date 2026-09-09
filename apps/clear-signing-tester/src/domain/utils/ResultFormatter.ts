import {
  type TestResult,
  type TestStatus,
} from "@root/src/domain/types/TestStatus";

/**
 * Common type for batch test results
 */
export type BatchTestResult = {
  readonly title: string;
  readonly resultsTable: Array<{
    Description: string;
    Status: string;
    Hash?: string;
  }>;
  readonly summaryTitle: string;
  readonly summaryTable: Array<{
    Status: string;
    Count: number;
    Percentage: string;
  }>;
  readonly exitCode: number;
  /** Per-status counts, so a caller need not parse the rendered tables. */
  readonly counts: StatusCounts;
};

/**
 * Status counts for batch operations
 */
export type StatusCounts = {
  readonly clearSigned: number;
  readonly blindSigned: number;
  readonly partiallyClearSigned: number;
  readonly error: number;
};

/**
 * Configuration for formatting results
 */
export type FormatConfig = {
  readonly title: string;
  readonly summaryTitle: string;
  readonly includeHash?: boolean;
};

/**
 * Utility class for formatting test results consistently across use cases
 */
export class ResultFormatter {
  /**
   * Count statuses from test results
   */
  static countStatuses(results: TestResult[]): StatusCounts {
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
   * Format batch results for CLI display
   */
  static formatBatchResults(
    results: TestResult[],
    totalItems: number,
    config: FormatConfig,
  ): BatchTestResult {
    const statusCounts = this.countStatuses(results);

    const resultsTable = results.map((testResult) => {
      const statusEmoji = this.getStatusEmoji(testResult.status);
      const asExpected = this.isAsExpected(testResult);
      const row: { Description: string; Status: string; Hash?: string } = {
        Description: testResult.input.description || "No description",
        Status:
          `${statusEmoji} ${testResult.status.replace(/_/g, " ")}` +
          (asExpected && testResult.status !== "clear_signed"
            ? " (expected)"
            : ""),
      };

      if (config.includeHash && "hash" in testResult && testResult.hash) {
        row.Hash = testResult.hash;
      }

      return row;
    });

    const pct = (n: number) =>
      totalItems > 0 ? `${((n / totalItems) * 100).toFixed(1)}%` : "N/A";

    const summaryTable = [
      {
        Status: "✅ Clear Signed",
        Count: statusCounts.clearSigned,
        Percentage: pct(statusCounts.clearSigned),
      },
      {
        Status: "⚠️ Partially Clear Signed",
        Count: statusCounts.partiallyClearSigned,
        Percentage: pct(statusCounts.partiallyClearSigned),
      },
      {
        Status: "🙈 Blind Signed",
        Count: statusCounts.blindSigned,
        Percentage: pct(statusCounts.blindSigned),
      },
      {
        Status: "❌ Errors",
        Count: statusCounts.error,
        Percentage: pct(statusCounts.error),
      },
    ];

    return {
      title: config.title,
      resultsTable,
      summaryTitle: config.summaryTitle,
      summaryTable,
      exitCode: totalItems - results.filter((r) => this.isAsExpected(r)).length,
      counts: statusCounts,
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

  /**
   * Get emoji for signing status
   */
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
