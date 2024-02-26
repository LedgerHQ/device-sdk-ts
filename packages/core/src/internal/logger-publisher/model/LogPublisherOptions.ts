export type LogPublisherContext = Partial<{
  type: string;
  tag: string;
  [key: string]: unknown;
}>;

export type LogPublisherData = Record<string, unknown>;

export type LogPublisherOptions = {
  tag?: string;
  timestamp?: number;
  data?: LogPublisherData;
  context?: LogPublisherContext;
};
