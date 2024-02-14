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

export type LogMessages = string[];

export type LogContructorArgs = {
  messages: LogMessages;
  data: LogData;
  context: LogContext;
};

export interface LoggerSubscriber {
  log(level: LogLevel, log: Log): void;
}

export class Log {
  messages: string[];
  data: Record<string, unknown> = {}; // use Maybe type for null/undefined ?
  context: LogContext = {}; // use Maybe type for null/undefined ?

  constructor({ messages, data, context }: LogContructorArgs) {
    this.messages = messages;
    this.data = data;
    this.context = context;
  }

  addMessage(message: string) {
    this.messages.push(message);
    return this;
  }
}
