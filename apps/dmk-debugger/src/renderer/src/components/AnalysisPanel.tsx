import { useState } from "react";

type AnalysisCommand = "analyze" | "diagram" | "clear-signing";

interface AnalysisSection {
  title: string;
  content: string;
  severity: "ok" | "info" | "warn" | "error";
}

interface AnalysisResult {
  command: AnalysisCommand;
  sections: AnalysisSection[];
}

const SEVERITY_DOTS: Record<string, string> = {
  ok: "#28a745",
  info: "#17a2b8",
  warn: "#ffc107",
  error: "#dc3545",
};

export default function AnalysisPanel(): JSX.Element {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (command: AnalysisCommand): Promise<void> => {
    setLoading(true);
    try {
      const res = await window.dmk.analyzeLocal(command);
      setResult(res);
    } catch (err) {
      setResult({
        command,
        sections: [
          {
            title: "Error",
            severity: "error",
            content: err instanceof Error ? err.message : String(err),
          },
        ],
      });
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <button style={styles.btn} onClick={() => run("analyze")} disabled={loading}>
          Analyze
        </button>
        <button style={styles.btn} onClick={() => run("diagram")} disabled={loading}>
          Diagram
        </button>
        <button style={styles.btn} onClick={() => run("clear-signing")} disabled={loading}>
          Clear Signing
        </button>
        {loading && <span style={styles.spinner}>Analyzing...</span>}
      </div>

      <div style={styles.content}>
        {!result && !loading && (
          <div style={styles.empty}>
            Run a local analysis on collected logs. This is a fast, deterministic analysis
            that decodes APDUs, detects patterns, and summarizes the session.
          </div>
        )}

        {result &&
          result.sections.map((section, i) => (
            <div key={i} style={styles.section}>
              <div style={styles.sectionHeader}>
                <span
                  style={{
                    ...styles.dot,
                    background: SEVERITY_DOTS[section.severity],
                  }}
                />
                <span style={styles.sectionTitle}>{section.title}</span>
              </div>
              <pre style={styles.sectionContent}>{section.content}</pre>
            </div>
          ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    border: "1px solid #0f3460",
    borderRadius: 4,
    background: "#16213e",
    color: "#e0e0e0",
    cursor: "pointer",
    fontSize: 12,
  },
  spinner: {
    color: "#8090a0",
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
  },
  section: {
    marginBottom: 16,
    background: "#16213e",
    borderRadius: 6,
    overflow: "hidden",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "#0f3460",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: 13,
    color: "#e0e0e0",
  },
  sectionContent: {
    margin: 0,
    padding: 12,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 12,
    lineHeight: "18px",
    color: "#c0c0c0",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
};
