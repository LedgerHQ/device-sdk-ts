import { z } from "zod";

import { getLogs } from "../logger";
import type { ToolDeps } from "./helpers";

export function register(deps: ToolDeps): void {
  deps.server.registerTool(
    "get_logs",
    {
      description:
        "Retrieve recent log entries for debugging. " +
        "Logs can be filtered by severity level and logger name.",
      inputSchema: {
        level: z
          .enum([
            "debug",
            "info",
            "notice",
            "warning",
            "error",
            "critical",
            "alert",
            "emergency",
          ])
          .optional()
          .describe("Filter logs by severity level."),
        logger: z
          .string()
          .optional()
          .describe(
            'Filter logs by logger name prefix (e.g. "dmk", "docker").',
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .default(50)
          .describe("Maximum number of entries to return."),
      },
    },
    async ({ level, logger, limit }) => {
      const entries = getLogs({ level, logger, limit });
      const text =
        entries.length === 0
          ? "No log entries found."
          : entries
              .map(
                (e) =>
                  `[${e.timestamp}] [${e.level.toUpperCase()}] [${e.logger}] ${e.message}`,
              )
              .join("\n");
      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );
}
