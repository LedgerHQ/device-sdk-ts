import { query } from "@anthropic-ai/claude-agent-sdk";

export interface ModelOption {
  value: string;
  displayName: string;
  description: string;
}

let sessionId: string | undefined;

export function resetSession(): void {
  sessionId = undefined;
  console.log(
    "[claude] Session reset — next analysis starts a fresh conversation",
  );
}

export async function fetchSupportedModels(): Promise<ModelOption[]> {
  try {
    const q = query({
      prompt: "",
      options: { allowedTools: [], maxTurns: 0, persistSession: false },
    });
    const models = await q.supportedModels();
    q.return(undefined as never).catch(() => {});
    return models.map((m) => ({
      value: m.value,
      displayName: m.displayName,
      description: m.description,
    }));
  } catch (err) {
    console.error("[claude] Failed to fetch models:", err);
    return [];
  }
}

export async function streamChat(
  message: string,
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (msg: string) => void,
  signal: AbortSignal,
): Promise<void> {
  if (!sessionId) {
    onError("No active session. Run an analysis first.");
    return;
  }

  let fullText = "";

  try {
    const stream = query({
      prompt: message,
      options: {
        allowedTools: [],
        maxTurns: 1,
        resume: sessionId,
      },
    });

    for await (const msg of stream) {
      if (signal.aborted) break;

      const m = msg as Record<string, unknown>;

      if (m.type === "stream_event") {
        const event = m.event as Record<string, unknown> | undefined;
        if (event?.type === "content_block_delta") {
          const delta = event.delta as Record<string, unknown> | undefined;
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            fullText += delta.text;
            onChunk(delta.text);
          }
        }
      }

      if (m.type === "assistant") {
        const betaMessage = m.message as Record<string, unknown> | undefined;
        if (betaMessage && Array.isArray(betaMessage.content)) {
          let assistantText = "";
          for (const block of betaMessage.content as Array<
            Record<string, unknown>
          >) {
            if (block.type === "text" && typeof block.text === "string") {
              assistantText += block.text;
            }
          }
          if (assistantText && assistantText.length > fullText.length) {
            const newText = assistantText.slice(fullText.length);
            fullText = assistantText;
            onChunk(newText);
          }
        }
      }

      if (m.type === "result" && typeof m.result === "string") {
        if (m.result.length > fullText.length) {
          const newText = m.result.slice(fullText.length);
          fullText = m.result;
          onChunk(newText);
        }
      }
    }

    onDone(fullText);
  } catch (err) {
    if (signal.aborted) {
      onDone(fullText);
      return;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[claude] Chat error:", errMsg);
    onError(errMsg);
  }
}

export async function streamAnalysis(
  prompt: string,
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (msg: string) => void,
  signal: AbortSignal,
  model?: string,
): Promise<void> {
  let fullText = "";

  try {
    const stream = query({
      prompt,
      options: {
        allowedTools: [],
        maxTurns: 1,
        ...(sessionId ? { resume: sessionId } : {}),
        ...(model ? { model } : {}),
      },
    });

    for await (const message of stream) {
      if (signal.aborted) break;

      const m = message as Record<string, unknown>;

      if (!sessionId && typeof m.session_id === "string") {
        sessionId = m.session_id;
        console.log(`[claude] Captured session ID: ${sessionId}`);
      }

      console.log(
        `[claude] message type=${m.type} subtype=${(m as Record<string, unknown>).subtype ?? ""}`,
      );

      // SDKPartialAssistantMessage: streaming text deltas
      if (m.type === "stream_event") {
        const event = m.event as Record<string, unknown> | undefined;
        if (event?.type === "content_block_delta") {
          const delta = event.delta as Record<string, unknown> | undefined;
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            fullText += delta.text;
            onChunk(delta.text);
          }
        }
      }

      // SDKAssistantMessage: full assistant response (arrives after streaming)
      if (m.type === "assistant") {
        const betaMessage = m.message as Record<string, unknown> | undefined;
        if (betaMessage && Array.isArray(betaMessage.content)) {
          let assistantText = "";
          for (const block of betaMessage.content as Array<
            Record<string, unknown>
          >) {
            if (block.type === "text" && typeof block.text === "string") {
              assistantText += block.text;
            }
          }
          if (assistantText && assistantText.length > fullText.length) {
            const newText = assistantText.slice(fullText.length);
            fullText = assistantText;
            onChunk(newText);
          }
        }
      }

      // SDKResultSuccess: final result
      if (m.type === "result" && typeof m.result === "string") {
        if (m.result.length > fullText.length) {
          const newText = m.result.slice(fullText.length);
          fullText = m.result;
          onChunk(newText);
        }
        console.log(`[claude] Result received (${fullText.length} chars)`);
      }
    }

    onDone(fullText);
  } catch (err) {
    if (signal.aborted) {
      onDone(fullText);
      return;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[claude] Error:", errMsg);
    onError(errMsg);
  }
}
