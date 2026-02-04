const MIN_POLLING_INTERVAL = 1000;

export type SessionRefresherOptions = {
  pollingInterval: number;
  isRefresherDisabled: boolean;
};

/**
 * Builds sessionRefresherOptions from the raw polling interval setting.
 * - If pollingInterval is 0, the refresher is disabled
 * - Otherwise, ensures pollingInterval is at least MIN_POLLING_INTERVAL (1000ms)
 */
export function buildSessionRefresherOptions(
  pollingInterval: number,
): SessionRefresherOptions {
  return {
    pollingInterval: Math.max(
      pollingInterval || MIN_POLLING_INTERVAL,
      MIN_POLLING_INTERVAL,
    ),
    isRefresherDisabled: pollingInterval === 0,
  };
}
