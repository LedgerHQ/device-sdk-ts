import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LoggingLevel } from "@modelcontextprotocol/sdk/types.js";

export type LogEntry = {
  timestamp: string;
  level: LoggingLevel;
  logger: string;
  message: string;
};

export type GetLogsOptions = {
  level?: LoggingLevel;
  logger?: string;
  limit?: number;
};

const MAX_BUFFER_SIZE = 500;
const ringBuffer: LogEntry[] = [];
let serverRef: McpServer | null = null;

export function bindServer(server: McpServer): void {
  serverRef = server;
}

function formatData(data: unknown): string {
  if (typeof data === "string") return data;
  return JSON.stringify(data, null, 0);
}

export function log(level: LoggingLevel, logger: string, data: unknown): void {
  const message = formatData(data);

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    logger,
    message,
  };

  if (ringBuffer.length >= MAX_BUFFER_SIZE) {
    ringBuffer.shift();
  }
  ringBuffer.push(entry);

  process.stderr.write(`[${level.toUpperCase()}] [${logger}] ${message}\n`);

  serverRef?.sendLoggingMessage({ level, logger, data }).catch(() => {});
}

export function getLogs(options: GetLogsOptions = {}): LogEntry[] {
  const { level, logger, limit = 50 } = options;

  let filtered: LogEntry[] = ringBuffer;

  if (level) {
    filtered = filtered.filter((e) => e.level === level);
  }
  if (logger) {
    filtered = filtered.filter((e) => e.logger.startsWith(logger));
  }

  return filtered.slice(-limit);
}

export function clearLogs(): void {
  ringBuffer.length = 0;
}
