import React, { useCallback, useEffect, useRef, useState } from "react";
import { IconButton, Spinner } from "@ledgerhq/lumen-ui-react";
import { ArrowUp, Check, SparksFill } from "@ledgerhq/lumen-ui-react/symbols";

import { ResizablePanel } from "../../components/ResizablePanel";
import { WithTooltip } from "../../components/WithTooltip";
import { INPUT, INPUT_WRAPPER } from "../logger/inputStyles";
import { AiAnswer } from "./AiAnswer";
import {
  type AiClient,
  type AiEvent,
  type AiRequest,
  type AiSelection,
  type AiStatus,
} from "./types";

/** A request from a view, numbered so asking twice about the same selection runs again. */
export type AiPanelRequest = AiSelection & { id: number };

type Turn = {
  question: string | null;
  steps: string[];
  text: string;
  answer: string | null;
  verdict: (AiEvent & { type: "done" })["verdict"];
  ticket: (AiEvent & { type: "done" })["ticket"];
  /** Claude started filing a ticket in this turn. */
  createsTicket: boolean;
  error: string | null;
};

const LABEL = "body-4-semi-bold text-muted uppercase";

const BUTTON =
  "cursor-pointer rounded-sm bg-muted-transparent px-12 py-6 body-3-semi-bold hover:bg-muted-transparent-hover";
const PRIMARY_BUTTON =
  "cursor-pointer rounded-sm bg-accent px-12 py-6 body-3-semi-bold text-on-accent hover:bg-accent-hover";

const Chip: React.FC<{
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ selected, disabled, onClick, children }) => (
  <button
    type="button"
    aria-pressed={selected}
    disabled={disabled}
    onClick={onClick}
    className={`cursor-pointer rounded-sm px-10 py-4 body-4 disabled:cursor-default disabled:opacity-50 ${selected ? "bg-active-subtle body-4-semi-bold text-active" : "bg-muted-transparent text-muted hover:bg-muted-transparent-hover"}`}
  >
    {children}
  </button>
);

const Message: React.FC<{ title: string; children?: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="flex flex-col gap-12 p-16">
    <h3 className="heading-5-semi-bold">{title}</h3>
    {children}
  </div>
);

const TurnView: React.FC<{ turn: Turn; running: boolean }> = ({
  turn,
  running,
}) => (
  <div className="flex flex-col gap-12">
    {turn.question && (
      <p className="self-end rounded-sm bg-muted px-12 py-8 body-3">
        {turn.question}
      </p>
    )}
    {turn.steps.length > 0 && (
      <ul className="flex flex-col gap-4 body-4 text-muted">
        {turn.steps.map((step, i) => (
          <li key={i} className="flex items-center gap-8">
            {running && i === turn.steps.length - 1 ? (
              <Spinner size={12} />
            ) : (
              <Check size={12} />
            )}
            {step}
          </li>
        ))}
      </ul>
    )}
    {turn.answer !== null ? (
      <AiAnswer markdown={turn.answer} />
    ) : (
      turn.text && <p className="body-3 whitespace-pre-wrap">{turn.text}</p>
    )}
    {running && turn.steps.length === 0 && !turn.text && (
      <p className="flex items-center gap-8 body-3 text-muted">
        <Spinner size={16} />
        Starting Claude Code…
      </p>
    )}
    {turn.error && (
      <div className="flex flex-col gap-4 rounded-sm bg-muted px-12 py-10">
        <span className="body-3-semi-bold text-error">
          Claude stopped before finishing
        </span>
        <span className="font-mono! body-4 break-words text-muted">
          {turn.error}
        </span>
      </div>
    )}
  </div>
);

// Session tokens the app shared, and anything that looks like a credential
const redact = (text: string, secrets: string[]) =>
  secrets
    .reduce(
      (redacted, secret) => redacted.replaceAll(secret, "<redacted>"),
      text,
    )
    .replace(/\b(bearer\s+)[^\s"',;]+/gi, "$1<redacted>")
    .replace(
      /\b((?:session[_-]?)?token|api[_-]?key|secret|password|authorization)(["']?\s*[:=]\s*["']?)(?!<redacted>)[^\s"',;&]+/gi,
      "$1$2<redacted>",
    );

const redactRequest = (request: AiRequest, secrets: string[]): AiRequest => {
  switch (request.kind) {
    case "explain":
      return { ...request, context: redact(request.context, secrets) };
    case "followUp":
      return { ...request, question: redact(request.question, secrets) };
    case "createTicket":
      return request;
  }
};

export const AiPanel: React.FC<{
  ai: AiClient | undefined;
  request: AiPanelRequest | null;
  /** Never sent to Claude: every request is redacted here. */
  secrets: string[];
}> = ({ ai, request, secrets }) => {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [readCode, setReadCode] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [question, setQuestion] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  // What the last turn asked, so Retry repeats a failed follow-up, not the first question
  const lastRunRef = useRef<{
    aiRequest: AiRequest;
    turnQuestion: string | null;
  } | null>(null);

  const checkStatus = useCallback(
    (refresh = false) => {
      if (!ai) return;
      setStatus(null);
      ai.status(refresh)
        .then(setStatus)
        .catch((error: unknown) =>
          setStatus({ ready: false, error: String(error) }),
        );
    },
    [ai],
  );

  useEffect(() => checkStatus(), [checkStatus]);

  // Rechecks without blanking the panel, for a connector connected meanwhile
  const refreshStatus = () => {
    ai
      ?.status(true)
      .then(setStatus)
      .catch(() => undefined);
  };
  useEffect(() => () => stopRef.current?.(), []);

  const updateLast = (update: (turn: Turn) => Turn) =>
    setTurns((previous) => [
      ...previous.slice(0, -1),
      update(previous.at(-1)!),
    ]);

  const run = useCallback(
    (aiRequest: AiRequest, turnQuestion: string | null, reset: boolean) => {
      if (!ai) return;
      stopRef.current?.();
      const turn: Turn = {
        question: turnQuestion,
        steps: [],
        text: "",
        answer: null,
        verdict: undefined,
        ticket: undefined,
        createsTicket: false,
        error: null,
      };
      setTurns((previous) => (reset ? [turn] : [...previous, turn]));
      if (reset) setSessionId(null);
      setRunning(true);
      lastRunRef.current = { aiRequest, turnQuestion };
      stopRef.current = ai.analyze(
        redactRequest(aiRequest, secrets),
        (event) => {
          switch (event.type) {
            case "step":
              updateLast((t) => ({
                ...t,
                steps: [...t.steps, event.text],
                createsTicket: t.createsTicket || event.createsTicket === true,
              }));
              break;
            case "text":
              updateLast((t) => ({ ...t, text: t.text + event.text }));
              break;
            case "done":
              updateLast((t) => ({
                ...t,
                answer: event.answer,
                verdict: event.verdict,
                ticket: event.ticket,
              }));
              setSessionId(event.sessionId);
              setRunning(false);
              stopRef.current = null;
              break;
            case "error":
              updateLast((t) => ({ ...t, error: event.message }));
              setRunning(false);
              stopRef.current = null;
              break;
          }
        },
      );
    },
    [ai, secrets],
  );

  const lastRequest = useRef<AiPanelRequest | null>(null);
  const explain = useCallback(
    (panelRequest: AiPanelRequest) => {
      lastRequest.current = panelRequest;
      run(
        {
          kind: "explain",
          context: panelRequest.context,
          summary: panelRequest.summary,
          readCode,
        },
        null,
        true,
      );
    },
    [run, readCode],
  );

  // A new "Explain with AI" from a view starts over, once Claude Code is ready
  const ready = status?.ready === true;
  useEffect(() => {
    if (request && ready && lastRequest.current?.id !== request.id) {
      explain(request);
    }
  }, [request, ready, explain]);

  const retry = () => {
    const last = lastRunRef.current;
    if (!last || last.aiRequest.kind === "explain") {
      explain(lastRequest.current!);
      return;
    }
    setTurns((previous) => previous.slice(0, -1));
    run(last.aiRequest, last.turnQuestion, false);
  };

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    setRunning(false);
    updateLast((t) => ({ ...t, error: t.answer === null ? "Stopped." : null }));
  };

  // A follow-up may revise the verdict: only the latest one counts
  const verdict = [...turns].reverse().find((turn) => turn.verdict)?.verdict;
  const foundBug = verdict === "bug";
  const ticket = turns.find((turn) => turn.ticket)?.ticket;
  // Stopped or failed after Jira was asked: the ticket may exist, so do not file it twice
  const ticketUnknown = turns.some(
    (turn, i) =>
      turn.createsTicket &&
      turn.answer === null &&
      !(running && i === turns.length - 1),
  );
  const canCreateTickets = status?.ready === true && status.canCreateTickets;

  const createTicket = () => {
    if (!sessionId) return;
    run({ kind: "createTicket", sessionId }, "Create a Jira ticket", false);
  };

  const ask = () => {
    const text = question.trim();
    if (!text || !sessionId) return;
    setQuestion("");
    run({ kind: "followUp", sessionId, question: text, readCode }, text, false);
  };

  const body = (() => {
    if (!ai) {
      return (
        <Message title="AI debugging needs the DevTools desktop app">
          <p className="body-3 text-muted">
            It runs Claude Code on your computer, which this panel cannot do.
            Open the same session in the desktop DevTools.
          </p>
        </Message>
      );
    }
    if (status === null) {
      return (
        <p className="flex items-center gap-8 p-16 body-3 text-muted">
          <Spinner size={16} />
          Checking Claude Code…
        </p>
      );
    }
    if (!status.ready) {
      return (
        <Message title="Sign in to Claude Code to use AI debugging">
          <p className="body-3 text-muted">
            The DevTools uses the Claude Code login on this computer. Nothing is
            sent until you press Explain with AI.
          </p>
          <span className="body-3">1. Install Claude Code</span>
          <code className="rounded-sm bg-muted px-10 py-6 font-mono! body-4">
            npm install -g @anthropic-ai/claude-code
          </code>
          <span className="body-3">2. Run it once to sign in</span>
          <code className="rounded-sm bg-muted px-10 py-6 font-mono! body-4">
            claude
          </code>
          <span className="font-mono! body-4 break-words text-muted">
            {status.error}
          </span>
          <button
            type="button"
            className={`self-start ${PRIMARY_BUTTON}`}
            onClick={() => checkStatus(true)}
          >
            Check again
          </button>
        </Message>
      );
    }
    if (turns.length === 0) {
      return (
        <Message title="Select logs or APDUs, then press Explain with AI">
          <p className="body-3 text-muted">
            Claude explains what happened and why, step by step, and draws the
            exchange between the app and the device.
          </p>
          <span className={LABEL}>Skills it uses</span>
          <div className="flex flex-wrap gap-6">
            {status.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-sm bg-muted-transparent px-8 py-2 font-mono! body-4 text-muted"
              >
                {skill}
              </span>
            ))}
          </div>
        </Message>
      );
    }
    return (
      <div className="flex flex-col gap-20 p-16">
        {turns.map((turn, i) => (
          <TurnView
            key={i}
            turn={turn}
            running={running && i === turns.length - 1}
          />
        ))}
        {!running && turns.at(-1)?.error && lastRequest.current && (
          <button
            type="button"
            className={`self-start ${PRIMARY_BUTTON}`}
            onClick={retry}
          >
            Retry
          </button>
        )}
      </div>
    );
  })();

  return (
    <ResizablePanel
      name="ai"
      defaultWidth={400}
      minWidth={320}
      maxWidth={800}
      edge="left"
      className="border-l border-muted-subtle bg-surface"
    >
      <aside className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-8 border-b border-muted-subtle px-16 py-12">
          <SparksFill size={16} className="text-active" />
          <h2 className="body-2-semi-bold">AI debugging</h2>
          {lastRequest.current && (
            <span className="truncate body-4 text-muted">
              · {lastRequest.current.summary}
            </span>
          )}
          <span className="flex-1" />
          {running && (
            <button type="button" className={BUTTON} onClick={stop}>
              Stop
            </button>
          )}
        </div>
        {ready && (
          <div className="flex items-center gap-6 px-16 pt-12">
            <Chip
              selected={!readCode}
              disabled={running}
              onClick={() => setReadCode(false)}
            >
              Quick
            </Chip>
            {status.canReadCode && (
              <WithTooltip label="Let Claude read DMK's source code to confirm the cause. Slower.">
                <Chip
                  selected={readCode}
                  disabled={running}
                  onClick={() => setReadCode(true)}
                >
                  Read the code
                </Chip>
              </WithTooltip>
            )}
            <span className="flex-1" />
            <span className="body-4 text-muted">{status.model}</span>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
        {ready && sessionId && (
          <div className="flex items-center gap-8 border-t border-muted-subtle px-16 py-12">
            <div className={`flex-1 ${INPUT_WRAPPER}`}>
              <input
                className={INPUT}
                type="text"
                placeholder="Ask a follow-up…"
                aria-label="Ask a follow-up question"
                value={question}
                disabled={running}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask()}
              />
            </div>
            <WithTooltip label="Ask">
              <IconButton
                aria-label="Ask"
                icon={ArrowUp}
                size="xs"
                appearance="transparent"
                className="rounded-sm [&>svg]:text-active"
                disabled={running || !question.trim()}
                onClick={ask}
              />
            </WithTooltip>
            {ticket ? (
              <a
                href={ticket.url}
                target="_blank"
                rel="noreferrer"
                className={`whitespace-nowrap ${BUTTON}`}
              >
                {ticket.key} ↗
              </a>
            ) : !foundBug ? null : ticketUnknown ? (
              <span className="body-4 text-muted">
                The ticket may already exist: check Jira
              </span>
            ) : canCreateTickets ? (
              <button
                type="button"
                className={`whitespace-nowrap ${PRIMARY_BUTTON} disabled:cursor-default disabled:opacity-50`}
                disabled={running}
                onClick={createTicket}
              >
                Create Jira ticket
              </button>
            ) : (
              <>
                <WithTooltip label="Connect Atlassian in Claude (claude.ai › Settings › Connectors) to create tickets">
                  <button
                    type="button"
                    disabled
                    className={`cursor-default whitespace-nowrap opacity-50 ${PRIMARY_BUTTON}`}
                  >
                    Create Jira ticket
                  </button>
                </WithTooltip>
                <button
                  type="button"
                  className={`whitespace-nowrap ${BUTTON}`}
                  onClick={refreshStatus}
                >
                  Check again
                </button>
              </>
            )}
          </div>
        )}
      </aside>
    </ResizablePanel>
  );
};
