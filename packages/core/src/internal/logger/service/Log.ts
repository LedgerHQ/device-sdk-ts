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

export type LogMessage = string;

export type LogContructorArgs = {
  messages: LogMessage[];
  data: LogData;
  context: LogContext;
  timestamp?: number;
};

export interface LoggerSubscriber {
  log(level: LogLevel, log: Log): void;
}

export class Log {
  messages: LogMessage[];
  data: Record<string, unknown> = {}; // use Maybe type for null/undefined ?
  context: LogContext = {}; // use Maybe type for null/undefined ?
  timestamp: number = Date.now();

  constructor({ messages, data, context, timestamp }: LogContructorArgs) {
    this.messages = messages;
    this.data = data;
    this.context = context;
    this.timestamp = timestamp ?? this.timestamp;
  }

  addMessage(message: string) {
    this.messages.push(message);
    return this;
  }
}
