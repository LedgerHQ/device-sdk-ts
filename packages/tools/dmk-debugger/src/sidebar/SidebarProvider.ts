import * as vscode from "vscode";

import type { AnalysisCommand } from "../analyzer/AnalyzerService";
import { AnalyzerService } from "../analyzer/AnalyzerService";
import type { LogEntry, LogStore } from "../store/LogStore";

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "dmkDebugger.sidebar";

  private view?: vscode.WebviewView;
  private readonly analyzer = new AnalyzerService();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly store: LogStore,
    private readonly serverPort: number,
    private readonly out: vscode.OutputChannel,
  ) {
    store.on("entry", (entry) => this.postEntry(entry));
    store.on("cleared", () => this.postMessage({ type: "cleared" }));
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: { type: string; payload?: unknown }) => {
      switch (message.type) {
        case "clear":
          this.store.clear();
          break;
        case "export":
          this.exportLogs();
          break;
        case "requestAll":
          this.sendAllEntries();
          break;
        case "analyze": {
          const command = ((message.payload as { command?: string })?.command ?? "analyze") as AnalysisCommand;
          this.runAnalysis(command);
          break;
        }
        case "deepAnalyze": {
          const cmd = ((message.payload as { command?: string })?.command ?? "analyze");
          this.openComposerWithPrompt(cmd);
          break;
        }
      }
    });
  }

  triggerAutoAnalysis(): void {
    this.runAnalysis("analyze");
  }

  private runAnalysis(command: AnalysisCommand): void {
    const result = this.analyzer.analyze(this.store, command);
    this.postMessage({ type: "analysisResult", payload: result });
  }

  private openComposerWithPrompt(command: string): void {
    void this.writePromptAndOpen(command).catch((e) =>
      this.out.appendLine(`[ask-opus] ERROR: ${e}`),
    );
  }

  private async writePromptAndOpen(command: string): Promise<void> {
    const endpoint = `http://localhost:${this.serverPort}/export`;
    const prompts: Record<string, string> = {
      analyze: [
        `Fetch the DMK debug logs by running: curl -s ${endpoint}`,
        "Then analyze them:",
        "- Identify errors and warnings",
        "- Decode APDU commands and status words",
        "- Detect failure patterns",
        "- Provide a clear diagnosis with suggested fixes",
      ].join("\n"),
      diagram: [
        `Fetch the DMK debug logs by running: curl -s ${endpoint}`,
        "Then generate a Mermaid sequence diagram of the APDU exchanges between Host and Device.",
        "Group related exchanges (Get App, Open App, Sign, etc.) and highlight errors.",
      ].join("\n"),
      "clear-signing": [
        `Fetch the DMK debug logs by running: curl -s ${endpoint}`,
        "Then analyze clear signing:",
        "- Look for PROVIDE_ERC20, PROVIDE_DOMAIN, PROVIDE_TRUSTED_NAME APDUs",
        "- Check context module logs",
        "- Determine if clear signing succeeded or failed, and why",
      ].join("\n"),
    };

    const prompt = prompts[command] ?? prompts["analyze"]!;

    // 1. Write prompt to clipboard
    await vscode.env.clipboard.writeText(prompt);
    this.out.appendLine(`[ask-opus] Clipboard written (${prompt.length} chars)`);

    // 2. Open a new agent chat — composer.newAgentChat opens an empty window,
    //    but the input field gets focus, so we can paste + submit into it.
    await vscode.commands.executeCommand("composer.newAgentChat");
    this.out.appendLine("[ask-opus] Composer opened, waiting for focus...");

    // 3. Give the composer input time to mount and gain focus
    await sleep(800);

    // 4. Try multiple paste strategies
    let pasted = false;

    // Strategy A: editor.action.clipboardPasteAction
    try {
      await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
      this.out.appendLine("[ask-opus] Paste via editor.action.clipboardPasteAction OK");
      pasted = true;
    } catch (e) {
      this.out.appendLine(`[ask-opus] editor.action.clipboardPasteAction failed: ${e}`);
    }

    // Strategy B: type command (sends keystrokes to focused input)
    if (!pasted) {
      try {
        await vscode.commands.executeCommand("type", { text: prompt });
        this.out.appendLine("[ask-opus] Paste via type command OK");
        pasted = true;
      } catch (e) {
        this.out.appendLine(`[ask-opus] type command failed: ${e}`);
      }
    }

    // Strategy C: default:type
    if (!pasted) {
      try {
        await vscode.commands.executeCommand("default:type", { text: prompt });
        this.out.appendLine("[ask-opus] Paste via default:type OK");
        pasted = true;
      } catch (e) {
        this.out.appendLine(`[ask-opus] default:type failed: ${e}`);
      }
    }

    if (!pasted) {
      this.out.appendLine("[ask-opus] All paste strategies failed — showing notification");
      void vscode.window.showInformationMessage(
        "Prompt copied — paste with ⌘V in the agent chat",
      );
      return;
    }

    // 5. Wait, then press Enter to submit
    await sleep(400);
    try {
      await vscode.commands.executeCommand("default:type", { text: "\n" });
      this.out.appendLine("[ask-opus] Enter sent via default:type");
    } catch {
      try {
        await vscode.commands.executeCommand("type", { text: "\n" });
        this.out.appendLine("[ask-opus] Enter sent via type");
      } catch (e) {
        this.out.appendLine(`[ask-opus] Enter failed: ${e}`);
      }
    }
  }

  private postEntry(entry: LogEntry): void {
    this.postMessage({ type: "entry", payload: entry });
  }

  private sendAllEntries(): void {
    const entries = this.store.getAll();
    this.postMessage({ type: "allEntries", payload: entries });
  }

  private postMessage(message: { type: string; payload?: unknown }): void {
    void this.view?.webview.postMessage(message);
  }

  private async exportLogs(): Promise<void> {
    const data = JSON.stringify(this.store.toJSON(), null, 2);
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`dmk-debug-export-${Date.now()}.json`),
      filters: { JSON: ["json"] },
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(data, "utf-8"));
      void vscode.window.showInformationMessage(`Exported ${this.store.size} log entries.`);
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DMK Debugger</title>
  <style nonce="${nonce}">
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-panel-border);
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
      --input-border: var(--vscode-input-border);
      --btn-bg: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
      --btn-hover: var(--vscode-button-hoverBackground);
      --badge-bg: var(--vscode-badge-background);
      --badge-fg: var(--vscode-badge-foreground);
      --desc: var(--vscode-descriptionForeground);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);
      color: var(--fg); background: var(--bg); padding: 8px;
    }
    .header {
      display: flex; align-items: center; gap: 8px; padding-bottom: 8px;
      border-bottom: 1px solid var(--border); margin-bottom: 8px; flex-wrap: wrap;
    }
    .status { display: flex; align-items: center; gap: 4px; font-size: 11px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #4caf50; }
    .badge { background: var(--badge-bg); color: var(--badge-fg); padding: 1px 6px; border-radius: 10px; font-size: 11px; }
    .controls { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
    button {
      background: var(--btn-bg); color: var(--btn-fg); border: none;
      padding: 4px 8px; cursor: pointer; font-size: 11px; border-radius: 2px;
    }
    button:hover { background: var(--btn-hover); }
    button.secondary { background: transparent; color: var(--fg); border: 1px solid var(--border); }
    .tabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 8px; }
    .tab {
      padding: 4px 12px; font-size: 11px; cursor: pointer;
      border-bottom: 2px solid transparent; color: var(--desc);
      background: none; border-radius: 0; border-left: none; border-right: none; border-top: none;
    }
    .tab:hover { color: var(--fg); }
    .tab.active { color: var(--fg); border-bottom-color: var(--btn-bg); }
    .panel { display: none; }
    .panel.active { display: block; }
    .filter-bar { display: flex; gap: 4px; margin-bottom: 8px; }
    .filter-bar input, .filter-bar select {
      background: var(--input-bg); color: var(--input-fg);
      border: 1px solid var(--input-border); padding: 3px 6px; font-size: 11px; flex: 1;
    }
    .filter-bar select { flex: 0 0 auto; }
    .scroll-area {
      overflow-y: auto; max-height: calc(100vh - 220px);
      font-family: var(--vscode-editor-font-family); font-size: 12px;
    }
    .log-entry {
      padding: 2px 4px; border-bottom: 1px solid var(--border);
      white-space: pre-wrap; word-break: break-all;
    }
    .log-entry:hover { background: var(--vscode-list-hoverBackground); }
    .log-entry .time { color: var(--desc); margin-right: 6px; }
    .log-entry .tag { color: var(--vscode-textLink-foreground); margin-right: 6px; }
    .log-entry.debug .level { color: #888; }
    .log-entry.info .level { color: #4fc3f7; }
    .log-entry.warn .level { color: #ffb74d; }
    .log-entry.error .level { color: #ef5350; }
    .level { margin-right: 6px; font-weight: bold; text-transform: uppercase; font-size: 10px; }
    .section {
      margin-bottom: 12px; border: 1px solid var(--border); border-radius: 4px; overflow: hidden;
    }
    .section-header {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px; font-weight: bold; font-size: 11px;
      background: var(--input-bg); border-bottom: 1px solid var(--border);
    }
    .section-header .dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }
    .dot.ok { background: #4caf50; }
    .dot.info { background: #4fc3f7; }
    .dot.warn { background: #ffb74d; }
    .dot.error { background: #ef5350; }
    .section-body {
      padding: 6px 8px; font-size: 12px; white-space: pre-wrap;
      word-break: break-word; font-family: var(--vscode-editor-font-family); line-height: 1.5;
    }
    .empty-state { text-align: center; padding: 32px 16px; color: var(--desc); }
    .empty-state code {
      display: block; margin-top: 8px; font-size: 11px;
      color: var(--vscode-textPreformat-foreground);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="status">
      <div class="status-dot"></div>
      <span>:${this.serverPort}</span>
    </div>
    <span class="badge" id="logCount">0 logs</span>
    <span class="badge" id="apduCount">0 APDUs</span>
  </div>
  <div class="controls">
    <button id="btnAnalyze">Analyze</button>
    <button id="btnDiagram">Diagram</button>
    <button id="btnClearSigning">Clear Signing</button>
    <button class="secondary" id="btnClear">Clear</button>
    <button class="secondary" id="btnExport">Export</button>
  </div>
  <div class="controls">
    <button class="secondary" id="btnDeepAnalyze">Ask Opus: Analyze</button>
    <button class="secondary" id="btnDeepDiagram">Ask Opus: Diagram</button>
  </div>
  <div class="tabs">
    <button class="tab active" data-tab="logs">Logs</button>
    <button class="tab" data-tab="analysis">Analysis</button>
  </div>
  <div class="panel active" id="panelLogs">
    <div class="filter-bar">
      <input type="text" id="searchInput" placeholder="Filter logs...">
      <select id="levelFilter">
        <option value="">All</option>
        <option value="debug">Debug</option>
        <option value="info">Info</option>
        <option value="warn">Warn</option>
        <option value="error">Error</option>
      </select>
    </div>
    <div class="scroll-area" id="logContainer">
      <div class="empty-state" id="emptyState">
        <p>No logs yet.</p>
        <code>POST http://localhost:${this.serverPort}/logs</code>
      </div>
    </div>
  </div>
  <div class="panel" id="panelAnalysis">
    <div class="scroll-area" id="analysisContainer">
      <div class="empty-state" id="analysisEmpty">
        <p>Click Analyze, Diagram, or Clear Signing.</p>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const entries = [];
    let filter = { search: '', level: '' };
    let autoScroll = true;
    let apduCount = 0;
    const logContainer = document.getElementById('logContainer');
    const emptyState = document.getElementById('emptyState');
    const logCountEl = document.getElementById('logCount');
    const apduCountEl = document.getElementById('apduCount');
    const analysisContainer = document.getElementById('analysisContainer');
    const analysisEmpty = document.getElementById('analysisEmpty');

    vscode.postMessage({ type: 'requestAll' });

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const name = tab.dataset.tab;
        document.getElementById('panel' + name.charAt(0).toUpperCase() + name.slice(1)).classList.add('active');
      });
    });
    function switchTab(name) {
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === name);
      });
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel' + name.charAt(0).toUpperCase() + name.slice(1)).classList.add('active');
    }

    // Messages


    window.addEventListener('message', event => {
      const msg = event.data;
      switch (msg.type) {
        case 'entry': addEntry(msg.payload); break;
        case 'allEntries':
          entries.length = 0; logContainer.innerHTML = '';
          msg.payload.forEach(e => addEntry(e)); break;
        case 'cleared':
          entries.length = 0; apduCount = 0;
          logContainer.innerHTML = ''; emptyState.style.display = 'block';
          analysisContainer.innerHTML = ''; analysisEmpty.style.display = 'block';
          analysisContainer.appendChild(analysisEmpty);
          updateCounts(); break;
        case 'analysisResult':
          renderAnalysis(msg.payload); break;
      }
    });

    function renderAnalysis(result) {
      analysisContainer.innerHTML = '';
      analysisEmpty.style.display = 'none';
      switchTab('analysis');
      for (const section of result.sections) {
        const div = document.createElement('div');
        div.className = 'section';
        div.innerHTML =
          '<div class="section-header"><span class="dot ' + section.severity + '"></span>' +
          escapeHtml(section.title) + '</div>' +
          '<div class="section-body">' + escapeHtml(section.content) + '</div>';
        analysisContainer.appendChild(div);
      }
    }

    function addEntry(entry) {
      entries.push(entry); emptyState.style.display = 'none';
      if (matchesFilter(entry)) renderEntry(entry);
      updateCounts();
    }
    function renderEntry(entry) {
      const div = document.createElement('div');
      div.className = 'log-entry ' + entry.level;
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });
      const tag = Array.isArray(entry.tag) ? entry.tag.join(':') : entry.tag;
      div.innerHTML =
        '<span class="time">' + escapeHtml(time) + '</span>' +
        '<span class="level">' + escapeHtml(entry.level) + '</span>' +
        '<span class="tag">[' + escapeHtml(tag) + ']</span> ' +
        '<span class="msg">' + escapeHtml(entry.message) + '</span>';
      logContainer.appendChild(div);
      if (autoScroll) logContainer.scrollTop = logContainer.scrollHeight;
    }
    function matchesFilter(entry) {
      if (filter.level && entry.level !== filter.level) return false;
      if (filter.search && !entry.message.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    }
    function applyFilter() {
      filter.search = document.getElementById('searchInput').value;
      filter.level = document.getElementById('levelFilter').value;
      logContainer.innerHTML = '';
      const matched = entries.filter(matchesFilter);
      if (matched.length === 0) { emptyState.style.display = 'block'; }
      else { emptyState.style.display = 'none'; matched.forEach(renderEntry); }
    }
    function updateCounts() {
      logCountEl.textContent = entries.length + ' logs';
      apduCountEl.textContent = apduCount + ' APDUs';
    }
    function escapeHtml(str) {
      const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
    }

    document.getElementById('btnAnalyze').addEventListener('click', () =>
      vscode.postMessage({ type: 'analyze', payload: { command: 'analyze' } }));
    document.getElementById('btnDiagram').addEventListener('click', () =>
      vscode.postMessage({ type: 'analyze', payload: { command: 'diagram' } }));
    document.getElementById('btnClearSigning').addEventListener('click', () =>
      vscode.postMessage({ type: 'analyze', payload: { command: 'clear-signing' } }));
    document.getElementById('btnClear').addEventListener('click', () =>
      vscode.postMessage({ type: 'clear' }));
    document.getElementById('btnExport').addEventListener('click', () =>
      vscode.postMessage({ type: 'export' }));
    document.getElementById('btnDeepAnalyze').addEventListener('click', () =>
      vscode.postMessage({ type: 'deepAnalyze', payload: { command: 'analyze' } }));
    document.getElementById('btnDeepDiagram').addEventListener('click', () =>
      vscode.postMessage({ type: 'deepAnalyze', payload: { command: 'diagram' } }));
    document.getElementById('searchInput').addEventListener('input', () => applyFilter());
    document.getElementById('levelFilter').addEventListener('change', () => applyFilter());
    logContainer.addEventListener('scroll', () => {
      autoScroll = logContainer.scrollHeight - logContainer.scrollTop - logContainer.clientHeight < 50;
    });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
