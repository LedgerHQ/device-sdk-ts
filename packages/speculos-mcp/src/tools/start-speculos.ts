import { z } from "zod";

import type { ToolDeps } from "./helpers";

export function register(deps: ToolDeps): void {
  deps.server.registerTool(
    "start_speculos",
    {
      description:
        "Start a Speculos emulator in a Docker container via cs-tester. " +
        "Requires Docker to be installed and COIN_APPS_PATH to be set. " +
        "The emulator will listen on the port configured for this MCP server (default 5000). " +
        "Call stop_speculos to shut it down.",
      inputSchema: {
        device: z
          .enum(["stax", "nanox", "nanos", "nanos+", "flex", "apex"])
          .default("stax")
          .describe("Ledger device model to emulate."),
        appEthVersion: z
          .string()
          .optional()
          .describe(
            "Ethereum app version (e.g. '1.19.1'). Uses latest if omitted.",
          ),
        osVersion: z
          .string()
          .optional()
          .describe(
            "Device OS version (e.g. '1.8.1'). Uses latest if omitted.",
          ),
        dockerImageTag: z
          .string()
          .default("latest")
          .describe("Docker image tag for ledger-app-dev-tools."),
        customAppPath: z
          .string()
          .optional()
          .describe(
            "Custom app path (relative to COIN_APPS_PATH or absolute). " +
              "Bypasses automatic Ethereum app resolution.",
          ),
        vncPort: z
          .number()
          .int()
          .min(1)
          .max(65535)
          .default(3337)
          .describe("Host port for the Speculos VNC server (default 3337)."),
      },
    },
    async ({
      device,
      appEthVersion,
      osVersion,
      dockerImageTag,
      customAppPath,
      vncPort,
    }) => {
      try {
        const result = await deps.csTester.start(deps.baseURL, {
          device,
          appEthVersion,
          osVersion,
          dockerImageTag,
          customAppPath,
          vncPort,
        });
        deps.client.setDevice(result.device);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "started",
                  device: result.device,
                  api_url: result.apiUrl,
                  vnc_url: result.vncUrl,
                },
                null,
                2,
              ),
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
