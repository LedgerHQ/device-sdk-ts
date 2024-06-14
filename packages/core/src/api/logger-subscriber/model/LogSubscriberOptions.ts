export type LogSubscriberData = Record<string, unknown>;

export type LogSubscriberOptions = {
  tag: string;
  timestamp: number;
  data?: LogSubscriberData;
};
