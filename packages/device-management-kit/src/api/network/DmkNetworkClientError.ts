export type DmkNetworkClientErrorParams = {
  message: string;
  status?: number;
  statusText?: string;
  responseBody?: string;
  isTimeout?: boolean;
  cause?: unknown;
};

/**
 * Error thrown by {@link DmkNetworkClient} for HTTP, timeout or transport-level
 * failures.
 *
 * - When the remote returned a non-2xx response, {@link status} and
 *   {@link statusText} are populated and {@link responseBody} contains the
 *   raw text body (best effort).
 * - When the request timed out via the client's `timeoutMs`,
 *   {@link isTimeout} is `true`.
 * - For other fetch/network failures, {@link cause} carries the original
 *   error.
 */
export class DmkNetworkClientError extends Error {
  public readonly status?: number;
  public readonly statusText?: string;
  public readonly responseBody?: string;
  public readonly isTimeout: boolean;
  public override readonly cause?: unknown;

  constructor(params: DmkNetworkClientErrorParams) {
    super(params.message);
    this.name = "DmkNetworkClientError";
    this.status = params.status;
    this.statusText = params.statusText;
    this.responseBody = params.responseBody;
    this.isTimeout = params.isTimeout ?? false;
    this.cause = params.cause;
  }
}
