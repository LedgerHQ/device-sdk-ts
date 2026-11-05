export type LogSubscriberData = Record<string, unknown>;

// Tag can be a single string or an array of strings for hierarchical tags
export type LogTag = string | string[];

export type LogSubscriberOptions = {
  // Formatted tag string (subscribers always receive a formatted string)
  readonly tag: string;
  // Same tags, unformatted, so subscribers can filter or group on them
  readonly tags: readonly string[];
  readonly timestamp: number;
  readonly data?: LogSubscriberData;
};
