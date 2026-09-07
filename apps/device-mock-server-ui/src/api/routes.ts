/**
 * Every path prefix the API client calls, read by `vite.config.ts` to proxy
 * them in development. A prefix missing here raises no error: Vite's SPA
 * fallback answers with `index.html`, and the client gets a page where it
 * expected JSON.
 */
export const API_ROUTE_PREFIXES = [
  "/auth",
  "/devices",
  "/export",
  "/health",
  "/import",
  "/sessions",
];
