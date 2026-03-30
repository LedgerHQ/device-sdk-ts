import { useState, useEffect, useRef, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MermaidBlock from "./MermaidBlock";

const LOADING_PHASES = [
  { after: 0, label: "Preparing log context..." },
  { after: 2000, label: "Sending logs to Claude..." },
  { after: 5000, label: "Analyzing APDU exchanges..." },
  { after: 10000, label: "Decoding device communication..." },
  { after: 18000, label: "Building sequence diagram..." },
  { after: 28000, label: "Finalizing analysis..." },
];

function useLoadingPhase(loading: boolean, hasText: boolean): string {
  const [phase, setPhase] = useState("");
  const startRef = useRef(0);

  useEffect(() => {
    if (!loading) {
      setPhase("");
      return;
    }
    if (hasText) {
      setPhase("Streaming response...");
      return;
    }

    startRef.current = Date.now();
    setPhase(LOADING_PHASES[0]!.label);

    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      let current = LOADING_PHASES[0]!.label;
      for (const p of LOADING_PHASES) {
        if (elapsed >= p.after) current = p.label;
      }
      setPhase(current);
    }, 500);

    return () => clearInterval(id);
  }, [loading, hasText]);

  return phase;
}

interface ModelOption {
  value: string;
  displayName: string;
  description: string;
}

export default function AiPanel(): JSX.Element {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);
  const phase = useLoadingPhase(loading, text.length > 0);

  useEffect(() => {
    window.dmk
      .listModels()
      .then(setModels)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const offChunk = window.dmk.onAiChunk((chunk) => {
      setText((prev) => prev + chunk);
    });
    const offDone = window.dmk.onAiDone(() => {
      setLoading(false);
    });
    const offError = window.dmk.onAiError((msg) => {
      setError(msg);
      setLoading(false);
    });
    const offCleared = window.dmk.onCleared(() => {
      setText("");
      setError(null);
      setLoading(false);
      window.dmk.cancelAi();
    });
    return () => {
      offChunk();
      offDone();
      offError();
      offCleared();
    };
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [text]);

  const run = (): void => {
    setText("");
    setError(null);
    setLoading(true);
    window.dmk.analyzeAi("analyze", model || undefined);
  };

  const cancel = (): void => {
    window.dmk.cancelAi();
    setLoading(false);
  };

  const newSession = (): void => {
    window.dmk.resetSession();
    setText("");
    setError(null);
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      <div style={styles.toolbar}>
        <span style={styles.toolbarTitle}>AI Analysis</span>
        <div style={styles.toolbarRight}>
          <select
            style={styles.modelSelect}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
            title={models.find((m) => m.value === model)?.description ?? ""}
          >
            <option value="">Default</option>
            {models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.displayName}
              </option>
            ))}
          </select>
          {loading ? (
            <>
              <span style={styles.streaming}>
                <span style={styles.streamDot} />
                {phase}
              </span>
              <button style={styles.btnCancel} onClick={cancel}>
                Stop
              </button>
            </>
          ) : (
            <>
              <button style={styles.btnRun} onClick={run}>
                Analyze
              </button>
              {text && (
                <button
                  style={styles.btnNewSession}
                  onClick={newSession}
                  title="Start a fresh AI conversation (clears cached context)"
                >
                  New Session
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div style={styles.content}>
        {!text && !loading && !error && (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>AI</div>
            <p style={styles.emptyText}>
              Analyze device communication logs with Claude.
              <br />
              APDU decoding, sequence diagrams, and diagnostics.
            </p>
            <button style={styles.btnRunLarge} onClick={run}>
              Analyze Logs
            </button>
          </div>
        )}

        {error && (
          <div style={styles.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading && !text && (
          <div style={styles.skeletonWrap}>
            <div style={styles.skeletonHeader}>
              <div
                style={{
                  ...styles.skeletonPulse,
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                }}
              />
              <div
                style={{ ...styles.skeletonPulse, width: 180, height: 16 }}
              />
            </div>
            <div
              style={{
                ...styles.skeletonPulse,
                width: "90%",
                height: 12,
                marginTop: 20,
              }}
            />
            <div
              style={{
                ...styles.skeletonPulse,
                width: "75%",
                height: 12,
                marginTop: 10,
              }}
            />
            <div
              style={{
                ...styles.skeletonPulse,
                width: "85%",
                height: 12,
                marginTop: 10,
              }}
            />
            <div
              style={{
                ...styles.skeletonPulse,
                width: "60%",
                height: 12,
                marginTop: 10,
              }}
            />
            <div
              style={{
                ...styles.skeletonPulse,
                width: "95%",
                height: 80,
                marginTop: 20,
                borderRadius: 6,
              }}
            />
            <div
              style={{
                ...styles.skeletonPulse,
                width: "70%",
                height: 12,
                marginTop: 20,
              }}
            />
            <div
              style={{
                ...styles.skeletonPulse,
                width: "80%",
                height: 12,
                marginTop: 10,
              }}
            />
          </div>
        )}

        {text && (
          <div ref={outputRef} style={styles.output}>
            <div className="markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 style={md.h1}>{children}</h1>,
                  h2: ({ children }) => <h2 style={md.h2}>{children}</h2>,
                  h3: ({ children }) => <h3 style={md.h3}>{children}</h3>,
                  h4: ({ children }) => <h4 style={md.h4}>{children}</h4>,
                  p: ({ children }) => <p style={md.p}>{children}</p>,
                  ul: ({ children }) => <ul style={md.ul}>{children}</ul>,
                  ol: ({ children }) => <ol style={md.ol}>{children}</ol>,
                  li: ({ children }) => <li style={md.li}>{children}</li>,
                  strong: ({ children }) => (
                    <strong style={md.strong}>{children}</strong>
                  ),
                  em: ({ children }) => <em style={md.em}>{children}</em>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      style={md.a}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote style={md.blockquote}>{children}</blockquote>
                  ),
                  hr: () => <hr style={md.hr} />,
                  code: ({ className, children }) => {
                    const isMermaid = className === "language-mermaid";
                    const isBlock = className?.startsWith("language-");
                    if (isMermaid) {
                      const raw = String(children).replace(/\n$/, "");
                      return <MermaidBlock code={raw} />;
                    }
                    return isBlock ? (
                      <pre style={md.pre}>
                        <code style={md.codeBlock}>{children}</code>
                      </pre>
                    ) : (
                      <code style={md.codeInline}>{children}</code>
                    );
                  },
                  pre: ({ children }) => <>{children}</>,
                  table: ({ children }) => (
                    <div style={md.tableWrapper}>
                      <table style={md.table}>{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead style={md.thead}>{children}</thead>
                  ),
                  th: ({ children }) => <th style={md.th}>{children}</th>,
                  td: ({ children }) => <td style={md.td}>{children}</td>,
                }}
              >
                {text}
              </ReactMarkdown>
            </div>
            {loading && <span style={styles.cursor}>|</span>}
          </div>
        )}
      </div>
    </div>
  );
}

const md: Record<string, CSSProperties> = {
  h1: {
    fontSize: 22,
    fontWeight: 700,
    color: "#f43f5e",
    margin: "24px 0 10px",
    paddingBottom: 8,
    borderBottom: "1px solid #334155",
  },
  h2: {
    fontSize: 18,
    fontWeight: 700,
    color: "#f1f5f9",
    margin: "20px 0 8px",
    paddingBottom: 6,
    borderBottom: "1px solid rgba(51, 65, 85, 0.5)",
  },
  h3: {
    fontSize: 16,
    fontWeight: 600,
    color: "#e2e8f0",
    margin: "16px 0 6px",
  },
  h4: {
    fontSize: 15,
    fontWeight: 600,
    color: "#cbd5e1",
    margin: "14px 0 4px",
  },
  p: {
    margin: "8px 0",
    lineHeight: "24px",
    color: "#e2e8f0",
    fontSize: 14,
  },
  ul: { margin: "6px 0", paddingLeft: 22 },
  ol: { margin: "6px 0", paddingLeft: 22 },
  li: {
    margin: "3px 0",
    lineHeight: "24px",
    color: "#e2e8f0",
    fontSize: 14,
  },
  strong: { color: "#f1f5f9", fontWeight: 600 },
  em: { color: "#c4b5fd", fontStyle: "italic" },
  a: { color: "#38bdf8", textDecoration: "underline" },
  blockquote: {
    margin: "10px 0",
    padding: "8px 14px",
    borderLeft: "3px solid #6366f1",
    background: "rgba(99, 102, 241, 0.1)",
    color: "#c7d2fe",
    fontSize: 14,
  },
  hr: { border: "none", borderTop: "1px solid #334155", margin: "16px 0" },
  pre: {
    margin: "10px 0",
    padding: 14,
    background: "#0f172a",
    borderRadius: 6,
    border: "1px solid #1e293b",
    overflowX: "auto",
  },
  codeBlock: {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 13,
    lineHeight: "20px",
    color: "#7dd3fc",
    whiteSpace: "pre",
  },
  codeInline: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    padding: "2px 6px",
    background: "#1e293b",
    borderRadius: 3,
    color: "#7dd3fc",
  },
  tableWrapper: { overflowX: "auto", margin: "10px 0" },
  table: { borderCollapse: "collapse", width: "100%", fontSize: 13 },
  thead: { background: "#1e293b" },
  th: {
    padding: "6px 12px",
    textAlign: "left",
    fontWeight: 600,
    color: "#f1f5f9",
    borderBottom: "1px solid #334155",
  },
  td: {
    padding: "5px 12px",
    borderBottom: "1px solid rgba(51, 65, 85, 0.4)",
    color: "#cbd5e1",
  },
};

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    overflow: "hidden",
    background: "#0f172a",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    height: 36,
    background: "#1e293b",
    borderBottom: "1px solid #334155",
    flexShrink: 0,
  },
  toolbarTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  modelSelect: {
    padding: "3px 6px",
    border: "1px solid #334155",
    borderRadius: 4,
    background: "#0f172a",
    color: "#cbd5e1",
    fontSize: 11,
    outline: "none",
    cursor: "pointer",
  },
  streaming: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#a78bfa",
    fontSize: 11,
  },
  streamDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#a78bfa",
    animation: "pulse-dot 1.2s ease-in-out infinite",
  },
  btnRun: {
    padding: "4px 12px",
    border: "none",
    borderRadius: 4,
    background: "#6366f1",
    color: "#fff",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 600,
  },
  btnRunLarge: {
    padding: "8px 24px",
    border: "none",
    borderRadius: 6,
    background: "#6366f1",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    marginTop: 16,
  },
  btnCancel: {
    padding: "4px 10px",
    border: "1px solid rgba(248, 113, 113, 0.3)",
    borderRadius: 4,
    background: "transparent",
    color: "#f87171",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 500,
  },
  btnNewSession: {
    padding: "4px 10px",
    border: "1px solid #334155",
    borderRadius: 4,
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 500,
  },
  content: {
    flex: 1,
    overflowY: "auto",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: 32,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "linear-gradient(135deg, #6366f1, #a78bfa)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 800,
    color: "#fff",
    marginBottom: 16,
  },
  emptyText: {
    color: "#64748b",
    textAlign: "center",
    lineHeight: "20px",
    fontSize: 12,
    margin: 0,
  },
  error: {
    margin: 12,
    padding: 10,
    background: "rgba(248, 113, 113, 0.1)",
    border: "1px solid rgba(248, 113, 113, 0.2)",
    borderRadius: 6,
    color: "#f87171",
    fontSize: 12,
  },
  output: {
    padding: 20,
    fontSize: 14,
    lineHeight: "24px",
    color: "#e2e8f0",
  },
  cursor: {
    color: "#a78bfa",
    fontWeight: 700,
    fontSize: 16,
  },
  skeletonWrap: {
    padding: 24,
  },
  skeletonHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  skeletonPulse: {
    height: 12,
    borderRadius: 4,
    background: "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.8s ease-in-out infinite",
  },
};
