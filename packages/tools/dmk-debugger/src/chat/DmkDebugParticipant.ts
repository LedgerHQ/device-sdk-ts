import * as vscode from "vscode";

import type { LogStore } from "../store/LogStore";
import {
  buildLogContext,
  SYSTEM_PROMPT_ANALYZE,
  SYSTEM_PROMPT_CLEAR_SIGNING,
  SYSTEM_PROMPT_DIAGRAM,
} from "../prompts/system";

export class DmkDebugParticipant {
  private participant: vscode.ChatParticipant;

  constructor(
    private readonly store: LogStore,
    context: vscode.ExtensionContext,
  ) {
    this.participant = vscode.chat.createChatParticipant(
      "dmk-debug",
      this.handleRequest.bind(this),
    );

    this.participant.iconPath = vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "icon.svg",
    );

    context.subscriptions.push(this.participant);
  }

  private async handleRequest(
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<void> {
    const logs = this.store.getAll();

    if (logs.length === 0) {
      stream.markdown(
        "No logs collected yet. Make sure your DMK application is sending logs to the debugger server.\n\n" +
        "Check the server is running with the health endpoint.",
      );
      return;
    }

    const logContext = buildLogContext(logs);

    const systemPrompt = this.getSystemPrompt(request.command);
    const userMessage = request.prompt || this.getDefaultUserMessage(request.command, logs.length);

    const models = await vscode.lm.selectChatModels({
      vendor: "copilot",
      family: "claude-sonnet",
    });

    let model = models[0];
    if (!model) {
      const allModels = await vscode.lm.selectChatModels();
      model = allModels[0];
    }

    if (!model) {
      stream.markdown(
        "No language model available. Make sure you have Cursor Pro or a language model extension installed.",
      );
      return;
    }

    const messages = [
      vscode.LanguageModelChatMessage.User(
        `${systemPrompt}\n\n---\n\n## Collected DMK Logs (${logs.length} entries)\n\n${logContext}\n\n---\n\n## User Request\n\n${userMessage}`,
      ),
    ];

    try {
      const response = await model.sendRequest(messages, {}, token);

      for await (const chunk of response.text) {
        stream.markdown(chunk);
      }
    } catch (err) {
      if (err instanceof vscode.LanguageModelError) {
        stream.markdown(`Language model error: ${err.message}`);
      } else {
        throw err;
      }
    }
  }

  private getSystemPrompt(command: string | undefined): string {
    switch (command) {
      case "diagram":
        return SYSTEM_PROMPT_DIAGRAM;
      case "clear-signing":
        return SYSTEM_PROMPT_CLEAR_SIGNING;
      case "analyze":
      default:
        return SYSTEM_PROMPT_ANALYZE;
    }
  }

  private getDefaultUserMessage(command: string | undefined, logCount: number): string {
    switch (command) {
      case "diagram":
        return `Generate a Mermaid sequence diagram showing the APDU exchange flow from the ${logCount} collected log entries.`;
      case "clear-signing":
        return `Analyze the ${logCount} collected log entries for clear signing issues. Was clear signing attempted? Did it succeed? If not, why?`;
      case "analyze":
      default:
        return `Analyze the ${logCount} collected DMK log entries. Identify any errors, unusual patterns, or issues, and provide a diagnosis.`;
    }
  }
}
