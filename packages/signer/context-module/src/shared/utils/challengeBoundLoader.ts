import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { makeCertificateCache } from "@/shared/utils/certificateCache";

/**
 * Shape every challenge-bound dynamic-descriptor result shares: the PKI
 * identifiers the host needs to load the matching certificate. The three
 * Solana challenge-bound loaders (token-account-state, alt-resolution,
 * trusted-name) each fetch a per-request descriptor whose backend response
 * reports its own `(keyId, keyUsage)`.
 */
export type ChallengeBoundResult = {
  keyId: string;
  keyUsage: string;
};

export type ChallengeBoundLoaderParams<
  TRequest,
  TResult extends ChallengeBoundResult,
> = {
  requests: TRequest[];
  deviceModelId: string;
  certificateLoader: PkiCertificateLoader;
  logger: LoggerPublisherService;
  /** Short UPPER_SNAKE label used in log messages, e.g. `"TRUSTED_NAME"`. */
  label: string;
  /** Issue the per-request backend fetch. */
  fetch: (request: TRequest) => Promise<Either<Error, TResult>>;
  /** Build the success context from a validated result + its certificate. */
  toContext: (result: TResult, certificate: PkiCertificate) => ClearSignContext;
  /** Structured fields attached to per-request log lines. */
  describe: (request: TRequest) => Record<string, unknown>;
};

/**
 * Orchestrates the shared lifecycle of the Solana challenge-bound loaders:
 * fan out the per-request fetches in parallel, dedup certificate loads per
 * batch via {@link makeCertificateCache}, and map each request to exactly
 * one {@link ClearSignContext}.
 *
 * A fetch failure, a certificate-load throw, or an absent (resolved-
 * `undefined`) certificate each degrade that single request to an ERROR
 * context — never the whole batch, and never a success context shipped
 * without a certificate.
 */
export async function loadChallengeBoundContexts<
  TRequest,
  TResult extends ChallengeBoundResult,
>({
  requests,
  deviceModelId,
  certificateLoader,
  logger,
  label,
  fetch,
  toContext,
  describe,
}: ChallengeBoundLoaderParams<TRequest, TResult>): Promise<ClearSignContext[]> {
  logger.debug(`[load] Fetching ${label} descriptors`, {
    data: { count: requests.length },
  });

  const fetched = await Promise.all(
    requests.map(async (request) => ({
      request,
      either: await fetch(request),
    })),
  );

  const getCert = makeCertificateCache(certificateLoader, deviceModelId);

  return Promise.all(
    fetched.map(({ request, either }) =>
      either.caseOf<Promise<ClearSignContext>>({
        Left: async (error) => {
          logger.warn(`[load] ${label} fetch failed`, {
            data: { ...describe(request), error: error.message },
          });
          return { type: ClearSignContextType.ERROR, error };
        },
        Right: async (value) => {
          let certificate: PkiCertificate | undefined;
          try {
            certificate = await getCert(value.keyId, value.keyUsage);
          } catch (caught) {
            const error =
              caught instanceof Error ? caught : new Error(String(caught));
            logger.warn(`[load] ${label} certificate load failed`, {
              data: { ...describe(request), error: error.message },
            });
            return { type: ClearSignContextType.ERROR, error };
          }
          if (!certificate) {
            const error = new Error(
              `[ContextModule] ${label}: certificate is missing`,
            );
            logger.warn(`[load] ${label} certificate missing`, {
              data: describe(request),
            });
            return { type: ClearSignContextType.ERROR, error };
          }
          return toContext(value, certificate);
        },
      }),
    ),
  );
}
