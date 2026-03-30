import { useState, useRef, useEffect } from "react";

interface LogEntry {
  id: number;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  tag: string | string[];
  timestamp: string;
  data?: unknown;
  receivedAt: number;
}

type LevelFilter = "all" | "debug" | "info" | "warn" | "error";

const LEVEL_COLORS: Record<string, string> = {
  debug: "#6c757d",
  info: "#17a2b8",
  warn: "#ffc107",
  error: "#dc3545",
};

export default function LogViewer({ logs }: { logs: LogEntry[] }): JSX.Element {
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = logs.filter((log) => {
    if (levelFilter !== "all" && log.level !== levelFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const tag = Array.isArray(log.tag) ? log.tag.join(":") : log.tag;
      if (
        !log.message.toLowerCase().includes(s) &&
        !tag.toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll]);

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
          style={styles.select}
        >
          <option value="all">All levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <input
          type="text"
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.search}
        />
        <label style={styles.autoScrollLabel}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
        <span style={styles.count}>{filtered.length} / {logs.length}</span>
      </div>

      <div ref={listRef} style={styles.list}>
        {filtered.length === 0 ? (
          <div style={styles.empty}>
            {logs.length === 0
              ? "No logs yet. Send logs to http://localhost:8432/logs"
              : "No logs match the current filters."}
          </div>
        ) : (
          filtered.map((log) => (
            <div key={log.id} style={styles.row}>
              <span style={styles.time}>
                {new Date(log.timestamp).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  fractionalSecondDigits: 3,
                } as Intl.DateTimeFormatOptions)}
              </span>
              <span
                style={{
                  ...styles.level,
                  color: LEVEL_COLORS[log.level],
                }}
              >
                {log.level.toUpperCase().padEnd(5)}
              </span>
              <span style={styles.tag}>
                {Array.isArray(log.tag) ? log.tag.join(":") : log.tag}
              </span>
              <span style={styles.message}>{log.message}</span>
            </div>
          ))
        )}
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
    padding: "6px 12px",
    background: "#1a1a2e",
    borderBottom: "1px solid #0f3460",
  },
  select: {
    padding: "4px 8px",
    background: "#16213e",
    border: "1px solid #0f3460",
    borderRadius: 4,
    color: "#e0e0e0",
    fontSize: 12,
  },
  search: {
    flex: 1,
    padding: "4px 8px",
    background: "#16213e",
    border: "1px solid #0f3460",
    borderRadius: 4,
    color: "#e0e0e0",
    fontSize: 12,
    outline: "none",
  },
  autoScrollLabel: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    color: "#8090a0",
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  count: {
    color: "#8090a0",
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  list: {
    flex: 1,
    overflowY: "auto",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: 12,
    lineHeight: "20px",
  },
  empty: {
    padding: 24,
    textAlign: "center",
    color: "#8090a0",
  },
  row: {
    display: "flex",
    gap: 8,
    padding: "1px 12px",
    borderBottom: "1px solid rgba(15, 52, 96, 0.4)",
    whiteSpace: "nowrap",
  },
  time: {
    color: "#6c757d",
    flexShrink: 0,
  },
  level: {
    fontWeight: 600,
    flexShrink: 0,
    width: 44,
  },
  tag: {
    color: "#53a8b6",
    flexShrink: 0,
    maxWidth: 200,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  message: {
    color: "#d0d0d0",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
};
