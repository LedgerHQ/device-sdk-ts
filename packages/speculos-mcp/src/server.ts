#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { CsTesterManager } from "./cs-tester-manager";
import { DmkSession } from "./dmk-session";
import { bindServer, log } from "./logger";
import { registerPrompts } from "./prompts";
import { createSpeculosClient } from "./speculos-client";
import { registerTools } from "./tools";

const resourcesDir = resolve(
  fileURLToPath(import.meta.url),
  "..",
  "..",
  "resources",
);

function readResource(filename: string): string {
  return readFileSync(resolve(resourcesDir, filename), "utf-8");
}

function registerResources(server: McpServer): void {
  server.resource(
    "Speculos signing workflow",
    "speculos://workflow",
    {
      description:
        "Step-by-step guide for the Ledger device signing workflow via Speculos.",
      mimeType: "text/markdown",
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: readResource("workflow.md"),
        },
      ],
    }),
  );
}

export async function createSpeculosServer(
  baseURL: string = process.env["SPECULOS_API_URL"] ?? "http://localhost:5000",
): Promise<McpServer> {
  const client = createSpeculosClient(baseURL);

  try {
    await client.checkConnection();
    log("info", "server", `Connected to Speculos at ${baseURL}`);
  } catch {
    log(
      "warning",
      "server",
      `Speculos is not reachable at ${baseURL}. ` +
        "Use the start_speculos tool to launch one, or start it manually.",
    );
  }

  const server = new McpServer(
    { name: "speculos", version: "0.1.0" },
    { instructions: readResource("workflow.md") },
  );

  const session = new DmkSession();
  const csTester = new CsTesterManager();

  bindServer(server);
  registerResources(server);
  registerPrompts(server);
  registerTools(server, client, baseURL, session, csTester);

  return server;
}

async function main() {
  const server = await createSpeculosServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  log(
    "error",
    "server",
    `Speculos MCP server failed to start: ${String(error)}`,
  );
  process.exit(1);
});
