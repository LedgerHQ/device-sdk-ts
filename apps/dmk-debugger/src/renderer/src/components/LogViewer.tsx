import { useState, useRef, useEffect, useCallback } from "react";

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
  debug: "#64748b",
  info: "#38bdf8",
  warn: "#facc15",
  error: "#f87171",
};

export default function LogViewer({ logs }: { logs: LogEntry[] }): JSX.Element {
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filtered = logs.filter((log) => {
    if (levelFilter !== "all" && log.level !== levelFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const tag = Array.isArray(log.tag) ? log.tag.join(":") : log.tag;
      if (!log.message.toLowerCase().includes(s) && !tag.toLowerCase().includes(s))
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
          placeholder="Filter logs..."
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
              ? "Waiting for logs..."
              : "No logs match the current filters."}
          </div>
        ) : (
          filtered.map((log) => {
            const hasData = log.data != null && (typeof log.data !== "object" || Object.keys(log.data as object).length > 0);
            const expanded = expandedIds.has(log.id);
            return (
              <div key={log.id}>
                <div
                  style={{
                    ...styles.row,
                    cursor: hasData ? "pointer" : "default",
                  }}
                  onClick={hasData ? () => toggleExpand(log.id) : undefined}
                >
                  <span style={styles.time}>
                    {new Date(log.timestamp).toLocaleTimeString("en-US", {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      fractionalSecondDigits: 3,
                    } as Intl.DateTimeFormatOptions)}
                  </span>
                  <span style={{ ...styles.level, color: LEVEL_COLORS[log.level] }}>
                    {log.level.toUpperCase().padEnd(5)}
                  </span>
                  <span style={styles.tag}>
                    {Array.isArray(log.tag) ? log.tag.join(":") : log.tag}
                  </span>
                  <span style={styles.message}>
                    {hasData && (
                      <span style={styles.expandIcon}>{expanded ? "\u25BC" : "\u25B6"}</span>
                    )}
                    {log.message}
                  </span>
                </div>
                {hasData && expanded && (
                  <pre style={styles.dataBlock}>
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
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
    background: "#1e293b",
    borderBottom: "1px solid #334155",
    flexShrink: 0,
  },
  select: {
    padding: "4px 8px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 4,
    color: "#e0e0e0",
    fontSize: 11,
    outline: "none",
  },
  search: {
    flex: 1,
    padding: "4px 8px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 4,
    color: "#e0e0e0",
    fontSize: 11,
    outline: "none",
  },
  autoScrollLabel: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    color: "#64748b",
    fontSize: 11,
    whiteSpace: "nowrap",
    userSelect: "none",
  },
  count: {
    color: "#475569",
    fontSize: 11,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  },
  list: {
    flex: 1,
    overflowY: "auto",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: 11,
    lineHeight: "20px",
  },
  empty: {
    padding: 32,
    textAlign: "center",
    color: "#475569",
    fontSize: 12,
  },
  row: {
    display: "flex",
    gap: 8,
    padding: "1px 12px",
    borderBottom: "1px solid rgba(51, 65, 85, 0.3)",
    whiteSpace: "nowrap",
  },
  time: {
    color: "#475569",
    flexShrink: 0,
  },
  level: {
    fontWeight: 600,
    flexShrink: 0,
    width: 44,
  },
  tag: {
    color: "#38bdf8",
    flexShrink: 0,
    maxWidth: 220,
    overflow: "hidden",
    textOverflow: "ellipsis",
    opacity: 0.7,
  },
  message: {
    color: "#cbd5e1",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  expandIcon: {
    marginRight: 4,
    fontSize: 9,
    color: "#475569",
  },
  dataBlock: {
    margin: "0 12px 0 52px",
    padding: "6px 10px",
    background: "#0f172a",
    borderLeft: "2px solid #334155",
    borderRadius: "0 0 4px 4px",
    color: "#7dd3fc",
    fontSize: 10,
    lineHeight: "15px",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
};
