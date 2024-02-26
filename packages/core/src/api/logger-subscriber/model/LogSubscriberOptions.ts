export type LogSubscriberContext = Partial<{
  type: string;
  tag: string;
  [key: string]: unknown;
}>;

export type LogSubscriberData = Record<string, unknown>;

export type LogSubscriberOptions = {
  tag: string;
  timestamp: number;
  data?: LogSubscriberData;
  context?: LogSubscriberContext;
};
