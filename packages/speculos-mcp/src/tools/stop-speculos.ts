import type { ToolDeps } from "./helpers";

export function register(deps: ToolDeps): void {
  deps.server.registerTool(
    "stop_speculos",
    {
      description:
        "Stop the Speculos Docker container that was started by start_speculos.",
    },
    async () => {
      try {
        await deps.csTester.stop();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ status: "stopped" }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "error",
                  message: err instanceof Error ? err.message : String(err),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
