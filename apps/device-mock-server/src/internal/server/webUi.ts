import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/** Searched in order, because the server is started from any of the three. */
const CANDIDATES = [
  // Docker: the image copies the built UI here.
  "public",
  // The monorepo root.
  "apps/device-mock-server-ui/dist",
  // apps/device-mock-server.
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
