import { useEffect, useRef, useState, type CSSProperties } from "react";
import mermaid from "mermaid";

let mermaidInitialized = false;

function initMermaid(): void {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    themeVariables: {
      darkMode: true,
      background: "#0d1b2a",
      primaryColor: "#2d1b69",
      primaryTextColor: "#e0e0e0",
      primaryBorderColor: "#533483",
      secondaryColor: "#0f3460",
      tertiaryColor: "#1a1a2e",
      lineColor: "#53a8b6",
      textColor: "#d0d0d0",
      mainBkg: "#16213e",
      nodeBkg: "#16213e",
      nodeBorder: "#533483",
      clusterBkg: "#0d1b2a",
      titleColor: "#e94560",
      actorBorder: "#533483",
      actorBkg: "#2d1b69",
      actorTextColor: "#e0e0e0",
      actorLineColor: "#53a8b6",
      signalColor: "#d0d0d0",
      signalTextColor: "#d0d0d0",
      noteBkgColor: "#0f3460",
      noteTextColor: "#a8dadc",
      noteBorderColor: "#533483",
      activationBorderColor: "#533483",
      activationBkgColor: "#1a1a2e",
    },
    securityLevel: "loose",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
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
          setSvg(rendered);
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
    background: "#0d1b2a",
    borderRadius: 6,
    border: "1px solid #0f3460",
    overflowX: "auto",
    textAlign: "center",
  },
  loading: {
    margin: "12px 0",
    padding: 16,
    background: "#0d1b2a",
    borderRadius: 6,
    border: "1px solid #0f3460",
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
    background: "#0d1b2a",
    borderRadius: 6,
    border: "1px solid #5c1a1a",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 12,
    lineHeight: "19px",
    color: "#a8dadc",
    whiteSpace: "pre",
    overflowX: "auto",
  },
};
