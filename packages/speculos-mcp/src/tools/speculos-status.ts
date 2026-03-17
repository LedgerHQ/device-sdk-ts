import type { ToolDeps } from "./helpers";

export function register(deps: ToolDeps): void {
  deps.server.registerTool(
    "speculos_status",
    {
      description:
        "Check whether a Speculos instance managed by this server is currently running.",
    },
    () => {
      const status = deps.csTester.getStatus();
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
