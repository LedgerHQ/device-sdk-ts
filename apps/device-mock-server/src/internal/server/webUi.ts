import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Where the built configuration UI (`@ledgerhq/device-mock-server-ui`) lives, so
 * the server can hand it out at its own root URL.
 *
 * The directory is looked up rather than hard-coded because the same server runs
 * from three places: the Docker image (which copies the bundle next to the
 * server), the repo root (turbo), and the package directory (`pnpm dev`).
 * `MOCK_SERVER_WEB_DIR` overrides the search; nothing found simply means no UI.
 */
const CANDIDATES = [
  // Docker: the image copies the built UI to /app/public.
  "public",
  // Run from the monorepo root.
  "apps/device-mock-server-ui/dist",
  // Run from apps/device-mock-server.
  "../device-mock-server-ui/dist",
];

const isBuiltUi = (dir: string): boolean => existsSync(join(dir, "index.html"));

export function resolveWebUiDir(
  override = process.env["MOCK_SERVER_WEB_DIR"],
): string | undefined {
  if (override) {
    const dir = resolve(override);
    return isBuiltUi(dir) ? dir : undefined;
  }
  return CANDIDATES.map((candidate) => resolve(process.cwd(), candidate)).find(
    isBuiltUi,
  );
}
