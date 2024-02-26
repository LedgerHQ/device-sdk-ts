export type LogPublisherData = Record<string, unknown>;

export type LogPublisherOptions = {
  tag?: string;
  timestamp?: number;
  data?: LogPublisherData;
};
