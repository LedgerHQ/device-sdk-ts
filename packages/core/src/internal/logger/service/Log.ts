export enum LogLevel {
  Fatal,
  Error,
  Warning,
  Info,
  Debug,
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
  level?: LogLevel;
};

export interface LoggerSubscriber {
  log(log: Log): void;
}

export class Log {
  level: LogLevel = LogLevel.Info;
  messages: string[];
  data: Record<string, unknown> = {}; // use Maybe type for null/undefined ?
  context: LogContext = {}; // use Maybe type for null/undefined ?

  constructor({ messages, data, context, level }: LogContructorArgs) {
    this.level = level ?? this.level;
    this.messages = messages;
    this.data = data;
    this.context = context;
  }

  setLevel(level: LogLevel) {
    this.level = level;
    return this;
  }

  addMessage(message: string) {
    this.messages.push(message);
    return this;
  }
}
