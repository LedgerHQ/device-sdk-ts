import {
  type SigningServiceResult,
  type TransactionSigningService,
} from "./TransactionSigningService";
import { type TypedDataSigningService } from "./TypedDataSigningService";

export type { SigningServiceResult };

/**
 * Combined signing service interface for backward compatibility.
 * Consumers should prefer the segregated interfaces directly:
 * - {@link TransactionSigningService}
 * - {@link TypedDataSigningService}
 */
export type SigningService = TransactionSigningService &
  TypedDataSigningService;
