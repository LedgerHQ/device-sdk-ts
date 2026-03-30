import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";

import type { LogStore } from "./store";
import { buildLogContext } from "./prompts";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface SseClient {
  id: string;
  res: Response;
}

export function mountMcpServer(app: Express, store: LogStore): void {
  const clients = new Map<string, SseClient>();

  app.get("/sse", (_req: Request, res: Response) => {
    const clientId = randomUUID();

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const messageEndpoint = `/mcp/message?sessionId=${clientId}`;
    res.write(`event: endpoint\ndata: ${messageEndpoint}\n\n`);

    clients.set(clientId, { id: clientId, res });

    _req.on("close", () => {
      clients.delete(clientId);
    });
  });

  app.post("/mcp/message", (req: Request, res: Response) => {
    const sessionId = req.query["sessionId"] as string;
    const client = clients.get(sessionId);

    if (!client) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const rpcReq = req.body as JsonRpcRequest;
    const response = handleRpcRequest(rpcReq, store);

    client.res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
    res.status(202).json({ status: "accepted" });
  });
}

function handleRpcRequest(
  req: JsonRpcRequest,
  store: LogStore,
): Record<string, unknown> {
  switch (req.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "dmk-debugger", version: "0.0.1" },
        },
      };

    case "notifications/initialized":
      return { jsonrpc: "2.0", id: req.id, result: {} };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          tools: [
            {
              name: "get_dmk_logs",
              description:
                "Get all collected DMK (Ledger Device Management Kit) logs. Returns structured log entries with level, message, tag, timestamp, and optional data.",
              inputSchema: {
                type: "object",
                properties: {
                  level: {
                    type: "string",
                    enum: ["debug", "info", "warn", "error"],
                    description: "Filter by log level",
                  },
                  tag: { type: "string", description: "Filter by tag (substring match)" },
                  search: { type: "string", description: "Search in log messages" },
                },
              },
            },
            {
              name: "get_apdu_exchanges",
              description:
                "Get extracted APDU exchanges between host and Ledger device.",
              inputSchema: { type: "object", properties: {} },
            },
            {
              name: "get_log_summary",
              description:
                "Get a summary of collected DMK logs including counts by level, total APDU exchanges, and session duration.",
              inputSchema: { type: "object", properties: {} },
            },
            {
              name: "get_formatted_logs",
              description:
                "Get all DMK logs formatted as a readable text timeline.",
              inputSchema: { type: "object", properties: {} },
            },
          ],
        },
      };

    case "tools/call":
      return handleToolCall(req, store);

    default:
      return {
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32601, message: `Method not found: ${req.method}` },
      };
  }
}

function handleToolCall(
  req: JsonRpcRequest,
  store: LogStore,
): Record<string, unknown> {
  const params = req.params as { name: string; arguments?: Record<string, string> } | undefined;
  const toolName = params?.name;
  const args = params?.arguments ?? {};

  switch (toolName) {
    case "get_dmk_logs": {
      const entries = store.query({
        level: args["level"] as "debug" | "info" | "warn" | "error" | undefined,
        tag: args["tag"],
        search: args["search"],
      });
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] },
      };
    }

    case "get_apdu_exchanges": {
      const exchanges = store.getApduExchanges();
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          content: [{
            type: "text",
            text: exchanges.length > 0 ? JSON.stringify(exchanges, null, 2) : "No APDU exchanges detected yet.",
          }],
        },
      };
    }

    case "get_log_summary": {
      const all = store.getAll();
      const byLevel = { debug: 0, info: 0, warn: 0, error: 0 };
      const errors: string[] = [];
      for (const entry of all) {
        byLevel[entry.level]++;
        if (entry.level === "error") {
          errors.push(`[${entry.timestamp}] ${entry.message}`);
        }
      }
      const firstTs = all[0]?.timestamp;
      const lastTs = all[all.length - 1]?.timestamp;
      const summary = {
        totalLogs: all.length,
        byLevel,
        apduExchanges: store.apduCount,
        sessionStart: firstTs ?? null,
        sessionEnd: lastTs ?? null,
        errors,
      };
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] },
      };
    }

    case "get_formatted_logs": {
      const logs = store.getAll();
      const formatted = buildLogContext(logs);
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: { content: [{ type: "text", text: formatted || "No logs collected yet." }] },
      };
    }

    default:
      return {
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32602, message: `Unknown tool: ${toolName}` },
      };
  }
}
