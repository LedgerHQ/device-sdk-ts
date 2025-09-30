import { injectable } from "inversify";
import { TestResult, TestStatus } from "../domain/types/TestStatus";

/**
 * Common batch result interface
 */
interface BatchResult {
    readonly totalItems: number;
    readonly clearSignedCount: number;
    readonly blindSignedCount: number;
    readonly partiallyClearSignedCount: number;
    readonly errorCount: number;
    readonly results: TestResult[];
}

/**
 * Service for displaying test results in console tables with emojis
 */
@injectable()
export class ResultDisplayService {
    /**
     * Display individual results in a table format with emojis
     */
    displayResultsTable(results: TestResult[], itemName: string): void {
        const tableData = results.map((testResult) => {
            const statusEmoji = this.getStatusEmoji(testResult.status);

            return {
                Description: testResult.input.description || "No description",
                Status: `${statusEmoji} ${testResult.status.replace(/_/g, " ")}`,
            };
        });

        console.log(`\n📋 ${itemName.toUpperCase()} TEST RESULTS:`);
        console.table(tableData);
    }

    /**
     * Display batch summary in a table format with emojis
     */
    displaySummaryTable(batchResult: BatchResult, itemName: string): void {
        const summaryData = [
            {
                Status: "✅ Clear Signed",
                Count: batchResult.clearSignedCount,
                Percentage: `${((batchResult.clearSignedCount / batchResult.totalItems) * 100).toFixed(1)}%`,
            },
            {
                Status: "⚠️ Partially Clear Signed",
                Count: batchResult.partiallyClearSignedCount,
                Percentage: `${((batchResult.partiallyClearSignedCount / batchResult.totalItems) * 100).toFixed(1)}%`,
            },
            {
                Status: "🔒 Blind Signed",
                Count: batchResult.blindSignedCount,
                Percentage: `${((batchResult.blindSignedCount / batchResult.totalItems) * 100).toFixed(1)}%`,
            },
            {
                Status: "❌ Errors",
                Count: batchResult.errorCount,
                Percentage: `${((batchResult.errorCount / batchResult.totalItems) * 100).toFixed(1)}%`,
            },
        ];

        console.log(
            `\n📊 ${itemName.toUpperCase()} BATCH SUMMARY (Total: ${batchResult.totalItems}):`,
        );
        console.table(summaryData);
    }

    /**
     * Get emoji for signing status
     */
    private getStatusEmoji(status: TestStatus): string {
        switch (status) {
            case "clear_signed":
                return "✅";
            case "partially_clear_signed":
                return "⚠️";
            case "blind_signed":
                return "🔒";
            case "error":
                return "❌";
            default:
                return "❓";
        }
    }
}
