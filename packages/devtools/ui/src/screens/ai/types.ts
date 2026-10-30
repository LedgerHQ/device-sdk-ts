/** What the user selected. */
export type AiSelection = {
  /** The selection, one log line or APDU exchange per line, oldest first. */
  context: string;
  /** What the selection holds, as the user sees it ("14 logs", "7 APDUs"). */
  summary: string;
};

export type AiRequest =
  | (AiSelection & {
      /** Explain what the user selected. */
      kind: "explain";
      /** Let Claude read DMK's source code, not only its skills. */
      readCode: boolean;
    })
  | {
      /** A follow-up question on an earlier answer. */
      kind: "followUp";
      sessionId: string;
      question: string;
      readCode: boolean;
    };

export type AiEvent =
  /** A tool Claude used, worded for the user ("Reading SignTransactionTask.ts"). */
  | { type: "step"; text: string }
  /** The next piece of the answer. */
  | { type: "text"; text: string }
  /** The full answer, replacing what streamed: text written before using a tool is not part of it. */
  | { type: "done"; sessionId: string; answer: string }
  | { type: "error"; message: string };

export type AiStatus =
  | {
      ready: true;
      account?: string;
      model: string;
      /** The skills every analysis uses. */
      skills: string[];
      canReadCode: boolean;
    }
  | { ready: false; error: string };

/**
 * Runs Claude for the AI panel. The Electron app provides one backed by the
 * local Claude Code login; without one the panel explains it needs that app.
 */
export type AiClient = {
  /** Cached for a while by the host; `refresh` checks again. */
  status: (refresh?: boolean) => Promise<AiStatus>;
  /** Streams the answer to `onEvent`; returns a function that stops it. */
  analyze: (
    request: AiRequest,
    onEvent: (event: AiEvent) => void,
  ) => () => void;
};
