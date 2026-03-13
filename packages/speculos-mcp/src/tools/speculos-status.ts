import { getStatus as getSpeculosStatus } from "../cs-tester-manager";
import type { ToolDeps } from "./helpers";

export function register({ server }: ToolDeps): void {
  server.registerTool(
    "speculos_status",
    {
      description:
        "Check whether a Speculos instance managed by this server is currently running.",
    },
    () => {
      const status = getSpeculosStatus();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    },
  );
}
