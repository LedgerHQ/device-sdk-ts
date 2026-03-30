import { useState, useEffect, useRef, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MermaidBlock from "./MermaidBlock";

export default function AiPanel(): JSX.Element {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

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
    return () => {
      offChunk();
      offDone();
      offError();
    };
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [text]);

  const run = (command: string): void => {
    setText("");
    setError(null);
    setLoading(true);
    window.dmk.analyzeAi(command);
  };

  const cancel = (): void => {
    window.dmk.cancelAi();
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <button style={styles.btn} onClick={() => run("analyze")} disabled={loading}>
          AI: Analyze
        </button>
        <button style={styles.btn} onClick={() => run("diagram")} disabled={loading}>
          AI: Diagram
        </button>
        <button style={styles.btn} onClick={() => run("clear-signing")} disabled={loading}>
          AI: Clear Signing
        </button>
        {loading && (
          <>
            <span style={styles.spinner}>Streaming...</span>
            <button style={styles.btnCancel} onClick={cancel}>
              Cancel
            </button>
          </>
        )}
      </div>

      <div style={styles.content}>
        {!text && !loading && !error && (
          <div style={styles.empty}>
            Run AI-powered analysis using Claude. Your logs will be sent to Claude
            for deep analysis, APDU decoding, and diagnostic suggestions.
            <br />
            <br />
            Requires <code style={styles.code}>ANTHROPIC_API_KEY</code> env var or a configured Claude subscription.
          </div>
        )}

        {error && (
          <div style={styles.error}>
            <strong>Error:</strong> {error}
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
                  strong: ({ children }) => <strong style={md.strong}>{children}</strong>,
                  em: ({ children }) => <em style={md.em}>{children}</em>,
                  a: ({ href, children }) => (
                    <a href={href} style={md.a} target="_blank" rel="noreferrer">
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => <blockquote style={md.blockquote}>{children}</blockquote>,
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
                  thead: ({ children }) => <thead style={md.thead}>{children}</thead>,
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
    fontSize: 20,
    fontWeight: 700,
    color: "#e94560",
    margin: "20px 0 10px",
    paddingBottom: 6,
    borderBottom: "1px solid #0f3460",
  },
  h2: {
    fontSize: 17,
    fontWeight: 700,
    color: "#e0e0e0",
    margin: "18px 0 8px",
    paddingBottom: 4,
    borderBottom: "1px solid rgba(15, 52, 96, 0.5)",
  },
  h3: {
    fontSize: 15,
    fontWeight: 600,
    color: "#c0c0c0",
    margin: "14px 0 6px",
  },
  h4: {
    fontSize: 13,
    fontWeight: 600,
    color: "#a0b0c0",
    margin: "12px 0 4px",
  },
  p: {
    margin: "8px 0",
    lineHeight: "22px",
    color: "#d0d0d0",
  },
  ul: {
    margin: "6px 0",
    paddingLeft: 24,
  },
  ol: {
    margin: "6px 0",
    paddingLeft: 24,
  },
  li: {
    margin: "3px 0",
    lineHeight: "21px",
    color: "#d0d0d0",
  },
  strong: {
    color: "#e0e0e0",
    fontWeight: 600,
  },
  em: {
    color: "#a78bfa",
    fontStyle: "italic",
  },
  a: {
    color: "#53a8b6",
    textDecoration: "underline",
  },
  blockquote: {
    margin: "8px 0",
    padding: "8px 14px",
    borderLeft: "3px solid #533483",
    background: "rgba(45, 27, 105, 0.3)",
    color: "#b0b0c0",
  },
  hr: {
    border: "none",
    borderTop: "1px solid #0f3460",
    margin: "16px 0",
  },
  pre: {
    margin: "10px 0",
    padding: 14,
    background: "#0d1b2a",
    borderRadius: 6,
    border: "1px solid #0f3460",
    overflowX: "auto",
  },
  codeBlock: {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: 12,
    lineHeight: "19px",
    color: "#a8dadc",
    whiteSpace: "pre",
  },
  codeInline: {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 12,
    padding: "1px 5px",
    background: "#0f3460",
    borderRadius: 3,
    color: "#a8dadc",
  },
  tableWrapper: {
    overflowX: "auto",
    margin: "10px 0",
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    fontSize: 12,
  },
  thead: {
    background: "#0f3460",
  },
  th: {
    padding: "6px 12px",
    textAlign: "left",
    fontWeight: 600,
    color: "#e0e0e0",
    borderBottom: "1px solid #1a3d6e",
  },
  td: {
    padding: "5px 12px",
    borderBottom: "1px solid rgba(15, 52, 96, 0.4)",
    color: "#c0c0c0",
  },
};

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    overflow: "hidden",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "#1a1a2e",
    borderBottom: "1px solid #0f3460",
  },
  btn: {
    padding: "6px 14px",
    border: "1px solid #533483",
    borderRadius: 4,
    background: "#2d1b69",
    color: "#e0e0e0",
    cursor: "pointer",
    fontSize: 12,
  },
  btnCancel: {
    padding: "6px 14px",
    border: "1px solid #5c1a1a",
    borderRadius: 4,
    background: "transparent",
    color: "#ff6b6b",
    cursor: "pointer",
    fontSize: 12,
  },
  spinner: {
    color: "#a78bfa",
    fontSize: 12,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: 12,
  },
  empty: {
    color: "#8090a0",
    textAlign: "center",
    padding: 24,
    lineHeight: "22px",
  },
  code: {
    padding: "2px 6px",
    background: "#0f3460",
    borderRadius: 3,
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
  },
  error: {
    padding: 12,
    background: "#3d1a1a",
    border: "1px solid #5c1a1a",
    borderRadius: 6,
    color: "#ff6b6b",
    fontSize: 13,
  },
  output: {
    padding: 16,
    background: "#16213e",
    borderRadius: 6,
    fontSize: 13,
    lineHeight: "22px",
    color: "#d0d0d0",
    overflowY: "auto",
    flex: 1,
  },
  cursor: {
    color: "#a78bfa",
    fontWeight: 700,
    fontSize: 16,
  },
};
