export enum LogLevel {
  Fatal = "FATAL",
  Error = "ERROR",
  Warning = "WARNING",
  Info = "INFO",
  Debug = "DEBUG",
}

export type LogContext = Partial<{
  type: string;
  tag: string;
  [key: string]: unknown;
}>;

export type LogData = Record<string, unknown>;

export type LogOptions = {
  data?: LogData;
  context?: LogContext;
  timestamp?: number;
};

export interface LoggerSubscriber {
  log(level: LogLevel, message: string, options?: LogOptions): void;
}
