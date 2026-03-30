import { useState, useEffect, useCallback, useRef } from "react";
import LogViewer from "./components/LogViewer";
import AiPanel from "./components/AiPanel";

interface LogEntry {
  id: number;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  tag: string | string[];
  timestamp: string;
  data?: unknown;
  receivedAt: number;
}

const HANDLE_W = 4;
const MIN_PANEL = 50;
const CONTENT_MIN_LOGS = 500;
const CONTENT_MIN_AI = 500;

export default function App(): JSX.Element {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [serverStatus, setServerStatus] = useState<
    "starting" | "running" | "error"
  >("starting");
  const [serverPort, setServerPort] = useState(0);
  const [dividerX, setDividerX] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const panelsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.dmk.getServerStatus().then((status) => {
      if (status.running) {
        setServerStatus("running");
        setServerPort(status.port);
      }
    });
    const offReady = window.dmk.onServerReady((port) => {
      setServerStatus("running");
      setServerPort(port);
    });
    const offError = window.dmk.onServerError(() => {
      setServerStatus("error");
    });
    return () => {
      offReady();
      offError();
    };
  }, []);

  useEffect(() => {
    window.dmk.getAllLogs().then((existing) => setLogs(existing));
  }, []);

  useEffect(() => {
    const off = window.dmk.onLogEntry((entry) => {
      setLogs((prev) => [...prev, entry]);
    });
    return off;
  }, []);

  useEffect(() => {
    const off = window.dmk.onCleared(() => setLogs([]));
    return off;
  }, []);

  const handleClear = useCallback(() => {
    window.dmk.clearLogs();
    setLogs([]);
  }, []);

  const handleExport = useCallback(() => {
    window.dmk.exportLogs();
  }, []);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent): void => {
      if (!panelsRef.current) return;
      const rect = panelsRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const max = rect.width - HANDLE_W - MIN_PANEL;
      setDividerX(Math.min(max, Math.max(MIN_PANEL, x)));
    };

    const onUp = (): void => setDragging(false);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  const panelW = panelsRef.current?.getBoundingClientRect().width ?? 0;
  const leftW = dividerX ?? Math.round(panelW * 0.58);
  const rightW = panelW - leftW - HANDLE_W;

  const errorCount = logs.filter((l) => l.level === "error").length;

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>DMK</span>
          <span style={styles.title}>Debugger</span>
          <div style={styles.divider} />
          <span
            style={{
              ...styles.statusDot,
              background:
                serverStatus === "running"
                  ? "#4ade80"
                  : serverStatus === "error"
                    ? "#f87171"
                    : "#facc15",
            }}
          />
          <span style={styles.statusText}>
            {serverStatus === "running"
              ? `Port ${serverPort}`
              : serverStatus === "error"
                ? "Server Error"
                : "Starting..."}
          </span>
          <div style={styles.divider} />
          <span style={styles.stat}>{logs.length} logs</span>
          {errorCount > 0 && (
            <span style={styles.statError}>{errorCount} errors</span>
          )}
        </div>
        <div style={styles.headerRight}>
          <button style={styles.btnGhost} onClick={() => {}}>
            Import
          </button>
          <button style={styles.btnGhost} onClick={handleExport}>
            Export
          </button>
          <button style={styles.btnDanger} onClick={handleClear}>
            Clear
          </button>
        </div>
      </header>

      <div ref={panelsRef} style={styles.panels}>
        {/* Logs panel: outer wrapper takes exact divider width, scrolls when content clips */}
        <div
          style={{
            width: leftW,
            flexShrink: 0,
            overflowX: "auto",
            overflowY: "hidden",
            display: "flex",
            flexDirection: "column" as const,
          }}
        >
          <div
            style={{
              minWidth: CONTENT_MIN_LOGS,
              flex: 1,
              display: "flex",
              flexDirection: "column" as const,
              overflow: "hidden",
            }}
          >
            <LogViewer logs={logs} />
          </div>
        </div>

        <div
          style={{
            ...styles.resizeHandle,
            background: dragging ? "#6366f1" : "#334155",
          }}
          onMouseDown={onDragStart}
        />

        {/* AI panel: outer wrapper takes remaining width, scrolls when content clips */}
        <div
          style={{
            width: rightW,
            flexShrink: 0,
            overflowX: "auto",
            overflowY: "hidden",
            display: "flex",
            flexDirection: "column" as const,
          }}
        >
          <div
            style={{
              minWidth: CONTENT_MIN_AI,
              flex: 1,
              display: "flex",
              flexDirection: "column" as const,
              overflow: "hidden",
            }}
          >
            <AiPanel />
          </div>
        </div>
      </div>

      {dragging && <div style={styles.dragOverlay} />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100vw",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13,
    color: "#e0e0e0",
    background: "#0f172a",
    overflow: "hidden",
    position: "relative",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    height: 42,
    background: "#1e293b",
    borderBottom: "1px solid #334155",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
    display: "flex",
    gap: 6,
  },
  logo: {
    fontWeight: 800,
    fontSize: 13,
    color: "#f43f5e",
    letterSpacing: 1,
  },
  title: {
    fontWeight: 500,
    fontSize: 13,
    color: "#94a3b8",
  },
  divider: {
    width: 1,
    height: 16,
    background: "#334155",
    margin: "0 4px",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    color: "#94a3b8",
  },
  stat: {
    fontSize: 11,
    color: "#64748b",
  },
  statError: {
    fontSize: 11,
    color: "#f87171",
    fontWeight: 600,
  },
  btnGhost: {
    padding: "4px 10px",
    border: "1px solid #334155",
    borderRadius: 4,
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 500,
  },
  btnDanger: {
    padding: "4px 10px",
    border: "1px solid rgba(248, 113, 113, 0.3)",
    borderRadius: 4,
    background: "transparent",
    color: "#f87171",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 500,
  },
  panels: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  resizeHandle: {
    width: HANDLE_W,
    cursor: "col-resize",
    flexShrink: 0,
    transition: "background 0.1s",
  },
  dragOverlay: {
    position: "fixed",
    inset: 0,
    cursor: "col-resize",
    zIndex: 9999,
  },
};
