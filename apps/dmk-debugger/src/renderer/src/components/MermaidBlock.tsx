import { useEffect, useRef, useState, type CSSProperties } from "react";
import mermaid from "mermaid";

let mermaidInitialized = false;

function initMermaid(): void {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      darkMode: true,
      background: "#1e293b",
      primaryColor: "#334155",
      primaryTextColor: "#f1f5f9",
      primaryBorderColor: "#6366f1",
      secondaryColor: "#334155",
      tertiaryColor: "#475569",
      lineColor: "#94a3b8",
      textColor: "#e2e8f0",
      mainBkg: "#334155",
      nodeBkg: "#334155",
      nodeBorder: "#6366f1",
      clusterBkg: "#263347",
      clusterBorder: "#475569",
      titleColor: "#e2e8f0",
      actorBorder: "#6366f1",
      actorBkg: "#6366f1",
      actorTextColor: "#ffffff",
      actorLineColor: "#475569",
      signalColor: "#e2e8f0",
      signalTextColor: "#e2e8f0",
      noteBkgColor: "#475569",
      noteTextColor: "#f1f5f9",
      noteBorderColor: "#6366f1",
      activationBorderColor: "#6366f1",
      activationBkgColor: "#334155",
      labelBoxBkgColor: "#334155",
      labelBoxBorderColor: "#6366f1",
      labelTextColor: "#e2e8f0",
      loopTextColor: "#e2e8f0",
      sequenceNumberColor: "#ffffff",
    },
    securityLevel: "loose",
    fontSize: 14,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  });
  mermaidInitialized = true;
}

let renderCounter = 0;

export default function MermaidBlock({ code }: { code: string }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code.trim()) return;

    initMermaid();

    const id = `mermaid-${++renderCounter}`;
    let cancelled = false;

    mermaid
      .render(id, code.trim())
      .then(({ svg: rendered }) => {
        if (!cancelled) {
          const overrideCss = `
            <style>
              .messageText, .sequenceNumber { fill: #f1f5f9 !important; font-weight: 600; }
              .messageText { filter: drop-shadow(0 0 2px rgba(0,0,0,0.8)); }
              .loopText, .loopText > tspan { fill: #f1f5f9 !important; font-weight: 700; }
              .labelText, .labelText > span { fill: #f1f5f9 !important; }
              .noteText, .noteText > tspan { fill: #f1f5f9 !important; }
              .actor-man text, text.actor { fill: #ffffff !important; }
              line.actor-line { stroke: #475569 !important; }
              .messageLine0, .messageLine1 { stroke: #94a3b8 !important; }
              marker#arrowhead path { fill: #94a3b8 !important; }
              marker#crosshead path { stroke: #94a3b8 !important; fill: #94a3b8 !important; }
              rect.rect { opacity: 0.15 !important; }
              .loopLine { stroke: #6366f1 !important; }
            </style>
          `;
          const patched = rendered.replace("</svg>", `${overrideCss}</svg>`);
          setSvg(patched);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setSvg(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorLabel}>Mermaid render error</div>
        <pre style={styles.fallbackCode}>{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return <div style={styles.loading}>Rendering diagram...</div>;
  }

  return (
    <div
      ref={containerRef}
      style={styles.container}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    margin: "12px 0",
    padding: 16,
    background: "#1e293b",
    borderRadius: 6,
    border: "1px solid #334155",
    overflowX: "auto",
    textAlign: "center",
  },
  loading: {
    margin: "12px 0",
    padding: 16,
    background: "#1e293b",
    borderRadius: 6,
    border: "1px solid #334155",
    color: "#a78bfa",
    textAlign: "center",
    fontSize: 12,
  },
  errorContainer: {
    margin: "12px 0",
  },
  errorLabel: {
    color: "#ff6b6b",
    fontSize: 11,
    marginBottom: 4,
    fontWeight: 600,
  },
  fallbackCode: {
    margin: 0,
    padding: 14,
    background: "#0f172a",
    borderRadius: 6,
    border: "1px solid rgba(248, 113, 113, 0.2)",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 11,
    lineHeight: "18px",
    color: "#7dd3fc",
    whiteSpace: "pre",
    overflowX: "auto",
  },
};
