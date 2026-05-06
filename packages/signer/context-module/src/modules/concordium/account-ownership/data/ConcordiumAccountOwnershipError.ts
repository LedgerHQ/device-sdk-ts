/**
 * Classification for errors returned by the trusted metadata service when
 * fetching an account-ownership descriptor.
 *
 * - `verification_failed`: the service was reached and actively refused the
 *   pubkey → address mapping (HTTP 4xx). Treat as a terminal, non-retryable
 *   verification failure.
 * - `service_unavailable`: the service could not answer (network failure,
 *   HTTP 5xx, malformed response). Treat as transient; fallback UI may be
 *   appropriate.
 */
export type ConcordiumAccountOwnershipErrorKind =
  | "verification_failed"
  | "service_unavailable";

export class ConcordiumAccountOwnershipError extends Error {
  readonly kind: ConcordiumAccountOwnershipErrorKind;

  constructor(kind: ConcordiumAccountOwnershipErrorKind, message: string) {
    super(message);
    this.name = "ConcordiumAccountOwnershipError";
    this.kind = kind;
  }
}
