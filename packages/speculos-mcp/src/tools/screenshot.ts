import type { ToolDeps } from "./helpers";

export function register({ server, client }: ToolDeps): void {
  server.registerTool(
    "screenshot",
    {
      description:
        "Capture a screenshot of the current Speculos device screen. " +
        "Debug-only — use this to inspect the device display when developing new actions or tools.",
    },
    async () => {
      const data = await client.fetchScreenshot();
      return {
        content: [
          {
            type: "image" as const,
            data,
            mimeType: "image/png",
          },
        ],
      };
    },
  );
}
