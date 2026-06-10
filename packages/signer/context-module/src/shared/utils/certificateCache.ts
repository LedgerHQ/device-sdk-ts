import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";

type LoadCertificate = PkiCertificateLoader["loadCertificate"];
type LoadCertificateResult = ReturnType<LoadCertificate>;
type CertificateLookup = (
  keyId: string,
  keyUsage: string,
) => LoadCertificateResult;

/**
 * Builds a per-batch certificate-loader memoiser. Returns a `(keyId,
 * keyUsage) => Promise<Certificate | undefined>` function that issues
 * `loadCertificate` once per distinct `(keyId, keyUsage)` pair and
 * returns the cached promise for every subsequent caller in the same
 * batch.
 *
 * Use when a single `load()` call fans out N requests whose backend
 * responses report `(keyId, keyUsage)` independently but, in the common
 * case, all reference the same PKI root — issuing N parallel duplicate
 * cert loads would waste cycles and bandwidth.
 *
 * The returned cache is intentionally short-lived: scope it to one
 * loader invocation, then drop it. Cross-invocation caching is a
 * different concern handled (or not) elsewhere.
 */
export function makeCertificateCache(
  certificateLoader: PkiCertificateLoader,
  targetDevice: string,
): CertificateLookup {
  const cache = new Map<string, LoadCertificateResult>();
  return (keyId, keyUsage) => {
    const key = `${keyId}::${keyUsage}`;
    let promise = cache.get(key);
    if (!promise) {
      promise = certificateLoader.loadCertificate({
        keyId,
        keyUsage,
        targetDevice,
      });
      cache.set(key, promise);
    }
    return promise;
  };
}
