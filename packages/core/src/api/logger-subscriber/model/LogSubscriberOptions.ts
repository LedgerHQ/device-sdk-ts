export type LogSubscriberData = Record<string, unknown>;

export type LogSubscriberOptions = {
  readonly tag: string;
  readonly timestamp: number;
  readonly data?: LogSubscriberData;
};
