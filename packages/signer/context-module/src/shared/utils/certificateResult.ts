import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import { type PkiCertificateInfo } from "@/modules/multichain/pki/model/PkiCertificateInfo";

/**
 * Tagged result of a certificate load attempt. Mirrors the
 * `Promise.allSettled`-style pattern but stays inside a single Promise
 * so callers can `Promise.all([certPromise, dataPromise])` to
 * parallelise cert + data fetches without one path's rejection tanking
 * the other.
 */
export type CertificateResult =
  | { ok: true; value: PkiCertificate | undefined }
  | { ok: false; error: Error };

/**
 * Wrap a `loadCertificate` call into a non-rejecting promise so it can
 * be awaited alongside a parallel data fetch via `Promise.all`. A
 * thrown error is normalised into a tagged `{ ok: false }` Result;
 * caller decides how to surface it (typically: one ERROR
 * ClearSignContext per request in the batch).
 */
export function loadCertificateResult(
  certificateLoader: PkiCertificateLoader,
  params: PkiCertificateInfo,
): Promise<CertificateResult> {
  return certificateLoader.loadCertificate(params).then(
    (value): CertificateResult => ({ ok: true, value }),
    (error: unknown): CertificateResult => ({
      ok: false,
      error:
        error instanceof Error
          ? error
          : new Error(
              typeof error === "string" ? error : JSON.stringify(error),
            ),
    }),
  );
}
