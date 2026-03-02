import * as vscode from "vscode";

import { createLogServer } from "./server";
import { SidebarProvider } from "./sidebar/SidebarProvider";
import { LogStore } from "./store/LogStore";

let stopServer: (() => Promise<void>) | null = null;

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration("dmkDebugger");
  const port = config.get<number>("server.port", 8432);
  const maxEntries = config.get<number>("store.maxEntries", 10_000);

  const store = new LogStore(maxEntries);
  const outputChannel = vscode.window.createOutputChannel("DMK Debugger");
  context.subscriptions.push(outputChannel);

  const sidebarProvider = new SidebarProvider(
    context.extensionUri,
    store,
    port,
    outputChannel,
  );

  void discoverChatCommands(outputChannel);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider,
    ),
  );

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  statusBarItem.text = "$(debug-alt) DMK";
  statusBarItem.tooltip = "DMK Debugger";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const server = createLogServer({
    port,
    store,
    onReady: (p) => {
      outputChannel.appendLine(`DMK Debugger server listening on port ${p}`);
      statusBarItem.text = `$(debug-alt) DMK :${p}`;
      statusBarItem.tooltip = `DMK Debugger — listening on port ${p}`;
    },
    onError: (err) => {
      outputChannel.appendLine(`Server error: ${err.message}`);
      void vscode.window.showErrorMessage(
        `DMK Debugger: failed to start on port ${port}: ${err.message}`,
      );
    },
  });

  void server.start();
  stopServer = server.stop;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  store.on("entry", (entry) => {
    const tag = Array.isArray(entry.tag) ? entry.tag.join(":") : entry.tag;
    outputChannel.appendLine(
      `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${tag}] ${entry.message}`,
    );
    statusBarItem.tooltip = `DMK Debugger — :${port} — ${store.size} logs`;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      sidebarProvider.triggerAutoAnalysis();
    }, 1500);
  });

  outputChannel.appendLine("DMK Debugger extension activated");
}

async function discoverChatCommands(out: vscode.OutputChannel): Promise<void> {
  const all = await vscode.commands.getCommands(true);
  const patterns = [/chat/i, /composer/i, /agent/i, /aipane/i, /copilot/i];
  const relevant = all.filter((c) => patterns.some((p) => p.test(c))).sort();
  out.appendLine(`[discovery] Found ${relevant.length} chat/composer commands:`);
  for (const cmd of relevant) {
    out.appendLine(`  - ${cmd}`);
  }
}

export function deactivate(): void {
  if (stopServer) {
    void stopServer();
    stopServer = null;
  }
}
