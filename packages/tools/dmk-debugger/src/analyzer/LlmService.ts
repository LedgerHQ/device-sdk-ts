import * as vscode from "vscode";

import { buildLogContext, SYSTEM_PROMPT_ANALYZE, SYSTEM_PROMPT_CLEAR_SIGNING, SYSTEM_PROMPT_DIAGRAM } from "../prompts/system";
import type { LogEntry } from "../store/LogStore";
import type { AnalysisCommand } from "./AnalyzerService";

export interface LlmCallbacks {
  onChunk: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (message: string) => void;
}

export class LlmService {
  private cancellation: vscode.CancellationTokenSource | null = null;

  constructor(private readonly outputChannel: vscode.OutputChannel) {
    // Log available models at startup and on changes
    void this.logAvailableModels();
    vscode.lm.onDidChangeChatModels(() => {
      this.outputChannel.appendLine("vscode.lm: models changed");
      void this.logAvailableModels();
    });
  }

  async run(
    command: AnalysisCommand,
    logs: LogEntry[],
    callbacks: LlmCallbacks,
  ): Promise<void> {
    this.cancel();

    const model = await this.selectModel();

    if (!model) {
      callbacks.onError(
        "No LLM model found. Make sure GitHub Copilot is enabled.\n" +
        "Check the 'DMK Debugger' output channel for details.",
      );
      return;
    }

    this.outputChannel.appendLine(`Using model: ${model.name} (${model.vendor}/${model.family} v${model.version})`);

    const logContext = buildLogContext(logs);
    const systemPrompt = this.getSystemPrompt(command);
    const userMessage = this.getDefaultUserMessage(command, logs.length);

    this.cancellation = new vscode.CancellationTokenSource();

    const messages = [
      vscode.LanguageModelChatMessage.User(
        `${systemPrompt}\n\n---\n\n## DMK Logs (${logs.length} entries)\n\n${logContext}\n\n---\n\n${userMessage}`,
      ),
    ];

    try {
      const response = await model.sendRequest(messages, {}, this.cancellation.token);
      let fullText = "";
      for await (const chunk of response.text) {
        if (this.cancellation.token.isCancellationRequested) break;
        fullText += chunk;
        callbacks.onChunk(chunk);
      }
      callbacks.onDone(fullText);
    } catch (err) {
      if (this.cancellation?.token.isCancellationRequested) return;

      const msg = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`LLM error: ${msg}`);

      // NoPermissions means the user needs to consent
      if (err instanceof vscode.LanguageModelError && err.code === "NoPermissions") {
        callbacks.onError(
          "Permission needed: Cursor/Copilot asked for consent to let this extension use the language model. " +
          "Please accept the permission dialog and try again.",
        );
      } else {
        callbacks.onError(`AI analysis failed: ${msg}`);
      }
    } finally {
      this.cancellation = null;
    }
  }

  cancel(): void {
    this.cancellation?.cancel();
    this.cancellation?.dispose();
    this.cancellation = null;
  }

  private async selectModel(): Promise<vscode.LanguageModelChat | undefined> {
    // Try multiple strategies to find the best model

    // 1. Try to get Claude Opus specifically
    const opusSelectors = [
      { vendor: "copilot", family: "claude-opus" },
      { vendor: "copilot", family: "claude-4-opus" },
      { family: "claude-opus" },
    ];

    for (const selector of opusSelectors) {
      try {
        const models = await vscode.lm.selectChatModels(selector);
        if (models.length > 0) {
          this.outputChannel.appendLine(`Found Opus via selector: ${JSON.stringify(selector)}`);
          return models[0];
        }
      } catch {
        // selector not supported, try next
      }
    }

    // 2. Try to get any Claude model
    try {
      const allModels = await vscode.lm.selectChatModels({});
      this.outputChannel.appendLine(`selectChatModels({}): ${allModels.length} model(s)`);

      const claude = allModels.find(
        (m) =>
          m.name.toLowerCase().includes("claude") ||
          m.family.toLowerCase().includes("claude"),
      );
      if (claude) return claude;

      // 3. Fall back to any model
      if (allModels.length > 0) return allModels[0];
    } catch (err) {
      this.outputChannel.appendLine(
        `selectChatModels({}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return undefined;
  }

  private async logAvailableModels(): Promise<void> {
    try {
      const models = await vscode.lm.selectChatModels({});
      this.outputChannel.appendLine(`vscode.lm: ${models.length} model(s) available:`);
      for (const m of models) {
        this.outputChannel.appendLine(
          `  • ${m.name} | vendor=${m.vendor} | family=${m.family} | version=${m.version} | maxInputTokens=${m.maxInputTokens}`,
        );
      }
      if (models.length === 0) {
        this.outputChannel.appendLine("  (none — is GitHub Copilot enabled and signed in?)");
      }
    } catch (err) {
      this.outputChannel.appendLine(
        `vscode.lm: failed to list models: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private getSystemPrompt(command: AnalysisCommand): string {
    switch (command) {
      case "diagram": return SYSTEM_PROMPT_DIAGRAM;
      case "clear-signing": return SYSTEM_PROMPT_CLEAR_SIGNING;
      case "analyze": return SYSTEM_PROMPT_ANALYZE;
    }
  }

  private getDefaultUserMessage(command: AnalysisCommand, logCount: number): string {
    switch (command) {
      case "diagram": return `Generate a Mermaid sequence diagram from the ${logCount} log entries.`;
      case "clear-signing": return `Analyze the ${logCount} entries for clear signing issues.`;
      case "analyze": return `Analyze the ${logCount} DMK log entries. Identify errors, patterns, and provide a diagnosis.`;
    }
  }
}
