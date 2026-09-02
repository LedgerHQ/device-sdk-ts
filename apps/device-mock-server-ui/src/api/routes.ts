/**
 * Every path prefix the API client calls on the mock server.
 *
 * In production the mock server serves this bundle, so these are same-origin
 * and the list is not consulted. `vite.config.ts` imports it to proxy exactly
 * these paths in development — a prefix missing here is not an error, it is
 * answered by Vite's SPA fallback with `index.html`, so the client gets a page
 * where it expected JSON. Add a prefix here whenever the client gains a route.
 */
export const API_ROUTE_PREFIXES = [
  "/auth",
  "/catalog",
  "/devices",
  "/export",
  "/health",
  "/import",
  "/sessions",
];
