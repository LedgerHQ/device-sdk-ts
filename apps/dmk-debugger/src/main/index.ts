import { app, shell, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "path";
import { LogStore } from "./store";
import { AnalyzerService } from "./analyzer";
import type { AnalysisCommand } from "./analyzer";
import { createLogServer } from "./server";
import {
  buildLogContext,
  SYSTEM_PROMPT_ANALYZE,
  SYSTEM_PROMPT_DIAGRAM,
  SYSTEM_PROMPT_CLEAR_SIGNING,
} from "./prompts";
import { streamAnalysis, fetchSupportedModels } from "./claude";
import { writeFile } from "fs/promises";
import type { LogEntry } from "./store";

const LOG_SERVER_PORTS = [8432, 8433, 8434];

const ACTION_WINDOW_MS = 5_000;

function hasTag(entry: LogEntry, pattern: string): boolean {
  const tags = Array.isArray(entry.tag) ? entry.tag : [entry.tag];
  return tags.some((t) => t.toLowerCase().includes(pattern));
}

function isActionLog(entry: LogEntry): boolean {
  return hasTag(entry, "XStateDeviceAction") || hasTag(entry, "signer");
}

function filterRelevantLogs(entries: LogEntry[]): LogEntry[] {
  const actionTimestamps = entries.filter(isActionLog).map((e) => e.receivedAt);

  function nearAction(ts: number): boolean {
    return actionTimestamps.some((at) => Math.abs(ts - at) <= ACTION_WINDOW_MS);
  }

  return entries.filter((entry) => {
    if (isActionLog(entry)) return true;
    return nearAction(entry.receivedAt);
  });
}

let lastActionAt = 0;

function isRelevantRealtime(entry: LogEntry): boolean {
  if (isActionLog(entry)) {
    lastActionAt = Date.now();
    return true;
  }
  return Date.now() - lastActionAt <= ACTION_WINDOW_MS;
}

const store = new LogStore();
const analyzer = new AnalyzerService();
let mainWindow: BrowserWindow | null = null;
let activeAiAbort: AbortController | null = null;
let serverRunning = false;
let actualPort = 0;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: "DMK Debugger",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow!.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (!app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle("logs:getAll", () => {
    const all = filterRelevantLogs(store.getAll());
    console.log(`[ipc] logs:getAll → returning ${all.length} entries`);
    return all;
  });

  ipcMain.handle("logs:clear", () => {
    store.clear();
    lastActionAt = 0;
    mainWindow?.webContents.send("logs:cleared");
  });

  ipcMain.handle("logs:export", async () => {
    const result = await dialog.showSaveDialog({
      title: "Export DMK Logs",
      defaultPath: `dmk-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!result.canceled && result.filePath) {
      await writeFile(result.filePath, JSON.stringify(store.toJSON(), null, 2));
      return { saved: true, path: result.filePath };
    }
    return { saved: false };
  });

  ipcMain.handle("analyze:local", (_event, command: AnalysisCommand) => {
    return analyzer.analyze(store, command);
  });

  ipcMain.handle("analyze:ai", (event, command: string, model?: string) => {
    if (activeAiAbort) activeAiAbort.abort();

    const ac = new AbortController();
    activeAiAbort = ac;

    const logs = filterRelevantLogs(store.getAll());
    if (logs.length === 0) {
      event.sender.send("ai:error", "No DMK logs collected yet.");
      return;
    }

    const logContext = buildLogContext(logs);

    const systemPrompts: Record<string, string> = {
      analyze: SYSTEM_PROMPT_ANALYZE,
      diagram: SYSTEM_PROMPT_DIAGRAM,
      "clear-signing": SYSTEM_PROMPT_CLEAR_SIGNING,
    };

    const instructions: Record<string, string> = {
      analyze:
        "Analyze these DMK logs. Identify errors, decode APDU commands and status words, detect failure patterns, and provide a clear diagnosis with suggested fixes.",
      diagram:
        "Generate a Mermaid sequence diagram from these DMK logs showing the APDU exchanges between Host and Device. Group related exchanges and highlight errors.",
      "clear-signing":
        "Analyze these DMK logs for clear signing issues. Determine if clear signing was attempted, what context was resolved, whether it succeeded or failed, and why.",
    };

    const systemPrompt = systemPrompts[command] ?? systemPrompts["analyze"]!;
    const instruction = instructions[command] ?? instructions["analyze"]!;

    const prompt = [
      systemPrompt,
      "",
      "---",
      "",
      `## DMK Logs (${logs.length} entries)`,
      "",
      logContext,
      "",
      "---",
      "",
      instruction,
    ].join("\n");

    void streamAnalysis(
      prompt,
      (chunk) => {
        if (!ac.signal.aborted) event.sender.send("ai:chunk", chunk);
      },
      (fullText) => {
        activeAiAbort = null;
        event.sender.send("ai:done", fullText);
      },
      (msg) => {
        activeAiAbort = null;
        event.sender.send("ai:error", msg);
      },
      ac.signal,
      model,
    );
  });

  ipcMain.handle("analyze:ai:cancel", () => {
    if (activeAiAbort) {
      activeAiAbort.abort();
      activeAiAbort = null;
    }
  });

  ipcMain.handle("models:list", () => fetchSupportedModels());

  ipcMain.handle("server:status", () => {
    return { running: serverRunning, port: actualPort, logCount: store.size };
  });
}

function wireStoreToRenderer(): void {
  store.on("entry", (entry) => {
    if (!isRelevantRealtime(entry)) return;
    console.log(
      `[ipc] Forwarding log #${entry.id} to renderer (window=${!!mainWindow})`,
    );
    mainWindow?.webContents.send("logs:entry", entry);
  });

  store.on("cleared", () => {
    console.log("[ipc] Forwarding cleared event to renderer");
    mainWindow?.webContents.send("logs:cleared");
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId?.("com.ledger.dmk-debugger");

  registerIpcHandlers();
  createWindow();
  wireStoreToRenderer();

  for (const port of LOG_SERVER_PORTS) {
    try {
      const { start } = createLogServer({
        port,
        store,
        onReady: (p) => {
          console.log(`DMK log server listening on http://localhost:${p}`);
          actualPort = p;
          serverRunning = true;
          mainWindow?.webContents.send("server:ready", p);
        },
        onError: (err) => {
          console.error(`Log server error on port ${port}:`, err.message);
        },
      });
      await start();
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Port ${port} unavailable: ${msg}, trying next...`);
      if (port === LOG_SERVER_PORTS[LOG_SERVER_PORTS.length - 1]) {
        console.error("Failed to start log server on any port");
        mainWindow?.webContents.send("server:error", "All ports unavailable");
      }
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
