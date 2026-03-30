import { useState, useEffect, useCallback, useRef } from "react";
import LogViewer from "./components/LogViewer";
import AnalysisPanel from "./components/AnalysisPanel";
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

type Tab = "logs" | "analysis" | "ai";

export default function App(): JSX.Element {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tab, setTab] = useState<Tab>("logs");
  const [serverStatus, setServerStatus] = useState<"starting" | "running" | "error">("starting");
  const [serverPort, setServerPort] = useState(0);
  const logsRef = useRef(logs);
  logsRef.current = logs;

  useEffect(() => {
    window.dmk.getServerStatus().then((status) => {
      console.log("[renderer] Server status:", status);
      if (status.running) {
        setServerStatus("running");
        setServerPort(status.port);
      }
    });
    const offReady = window.dmk.onServerReady((port) => {
      console.log("[renderer] Server ready on port", port);
      setServerStatus("running");
      setServerPort(port);
    });
    const offError = window.dmk.onServerError((msg) => {
      console.error("[renderer] Server error:", msg);
      setServerStatus("error");
    });
    return () => { offReady(); offError(); };
  }, []);

  useEffect(() => {
    window.dmk.getAllLogs().then((existing) => {
      console.log("[renderer] Initial logs:", existing.length);
      setLogs(existing);
    });
  }, []);

  useEffect(() => {
    const off = window.dmk.onLogEntry((entry) => {
      console.log("[renderer] New log entry:", entry.id, entry.message);
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

  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;

  return (
    <div style={styles.container}>
      {/* Top bar */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.title}>DMK Debugger</span>
          <span style={{
            ...styles.badge,
            ...(serverStatus === "running" ? styles.badgeOk : serverStatus === "error" ? styles.badgeError : {}),
          }}>
            {serverStatus === "running" ? `localhost:${serverPort}` : serverStatus === "error" ? "Server Error" : "Starting..."}
          </span>
          <span style={styles.badge}>{logs.length} logs</span>
          {errorCount > 0 && (
            <span style={{ ...styles.badge, ...styles.badgeError }}>
              {errorCount} errors
            </span>
          )}
          {warnCount > 0 && (
            <span style={{ ...styles.badge, ...styles.badgeWarn }}>
              {warnCount} warnings
            </span>
          )}
        </div>
        <div style={styles.headerRight}>
          <button style={styles.btnSecondary} onClick={handleExport}>
            Export
          </button>
          <button style={styles.btnDanger} onClick={handleClear}>
            Clear
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav style={styles.tabs}>
        {(["logs", "analysis", "ai"] as Tab[]).map((t) => (
          <button
            key={t}
            style={tab === t ? { ...styles.tab, ...styles.tabActive } : styles.tab}
            onClick={() => setTab(t)}
          >
            {t === "logs" ? "Logs" : t === "analysis" ? "Analysis" : "AI Analysis"}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={styles.main}>
        {tab === "logs" && <LogViewer logs={logs} />}
        {tab === "analysis" && <AnalysisPanel />}
        {tab === "ai" && <AiPanel />}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 13,
    color: "#e0e0e0",
    background: "#1a1a2e",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    background: "#16213e",
    borderBottom: "1px solid #0f3460",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  headerRight: {
    display: "flex",
    gap: 8,
  },
  title: {
    fontWeight: 700,
    fontSize: 15,
    color: "#e94560",
  },
  badge: {
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 11,
    background: "#0f3460",
    color: "#a0b0c0",
  },
  badgeOk: {
    background: "#1a3d1a",
    color: "#6bff6b",
  },
  badgeError: {
    background: "#5c1a1a",
    color: "#ff6b6b",
  },
  badgeWarn: {
    background: "#5c4a1a",
    color: "#ffa500",
  },
  tabs: {
    display: "flex",
    gap: 0,
    background: "#16213e",
    borderBottom: "1px solid #0f3460",
  },
  tab: {
    padding: "8px 20px",
    border: "none",
    background: "transparent",
    color: "#8090a0",
    cursor: "pointer",
    fontSize: 13,
    borderBottom: "2px solid transparent",
  },
  tabActive: {
    color: "#e94560",
    borderBottom: "2px solid #e94560",
  },
  main: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  btnSecondary: {
    padding: "4px 12px",
    border: "1px solid #0f3460",
    borderRadius: 4,
    background: "transparent",
    color: "#a0b0c0",
    cursor: "pointer",
    fontSize: 12,
  },
  btnDanger: {
    padding: "4px 12px",
    border: "1px solid #5c1a1a",
    borderRadius: 4,
    background: "transparent",
    color: "#ff6b6b",
    cursor: "pointer",
    fontSize: 12,
  },
};
