// @vitest-environment node
import { readFileSync } from "node:fs";

import {
  generateApduCommands,
  OUT_FILE,
} from "../../../scripts/generate-apdu-commands";

describe("apduCommands", () => {
  it("matches the command classes (run `pnpm generate:apdu-commands` to update)", async () => {
    expect(readFileSync(OUT_FILE, "utf8")).toBe(await generateApduCommands());
  }, 60_000);
});
