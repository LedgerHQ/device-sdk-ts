import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register({ server, client }: ToolDeps): void {
  server.registerTool(
    "read",
    {
      description:
        "Read the current screen text and signing status. Safe, read-only.",
    },
    async () => toolResponse(client),
  );
}
