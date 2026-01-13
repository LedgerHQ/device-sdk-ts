/**
 * Generic retry service interface for operations that need polling or retry logic
 */
export interface RetryService {
  /**
   * Retry an operation until a condition is met or max attempts reached
   * @param operation - The operation to execute
   * @param condition - Function that returns true when the desired condition is met
   * @param maxAttempts - Maximum number of attempts
   * @param delayMs - Delay in milliseconds between attempts
   * @throws Error when max attempts exceeded
   */
  retryUntil<T>(
    operation: () => Promise<T>,
    condition: (result: T) => boolean | Promise<boolean>,
    maxAttempts: number,
    delayMs: number,
  ): Promise<T>;

  /**
   * Retry an operation until it succeeds (no exception thrown) or max attempts reached
   * @param operation - The operation to execute
   * @param maxAttempts - Maximum number of attempts
   * @param delayMs - Delay in milliseconds between attempts
   * @throws Error when max attempts exceeded
   */
  retryUntilSuccess<T>(
    operation: () => Promise<T>,
    maxAttempts: number,
    delayMs: number,
  ): Promise<T>;

  /**
   * Poll until a condition is met
   * @param checkCondition - Function to check if condition is met
   * @param maxAttempts - Maximum number of attempts
   * @param delayMs - Delay in milliseconds between attempts
   * @throws Error when max attempts exceeded
   */
  pollUntil(
    checkCondition: () => Promise<boolean>,
    maxAttempts: number,
    delayMs: number,
  ): Promise<void>;
}
