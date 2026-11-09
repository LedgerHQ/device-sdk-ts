import React, { useCallback, useEffect, useMemo, useRef } from "react";

import { type ColumnSizing } from "./logsTable/TableColumns";
import { TableHeader } from "./logsTable/TableHeader";
import { NotConnectedMessage } from "../../shared/NotConnectedMessage";
import { SelectionBar } from "../ai/SelectionBar";
import { type AiSelection } from "../ai/types";
import { useDragSelect } from "../ai/useDragSelect";
import { LogCounts } from "./LogCounts";
import { LoggerToolbar } from "./LoggerToolbar";
import { LogsTable } from "./logsTable";
import { type LogData } from "./types";
import { useLogsDataAndOptions } from "./useLogsDataAndOptions";
import { useSearchState } from "./useSearchState";

type Props = {
  logs: Array<LogData>;
  clearLogs: () => void;
  isConnected?: boolean;
  onExplain: (request: AiSelection) => void;
};

const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  });

const toContextLine = (log: LogData) =>
  `[${log.timestamp}] [${log.verbosity.toUpperCase()}] ${log.tag} ${log.message}${log.payloadJSON && log.payloadJSON !== "{}" ? ` | ${log.payloadJSON}` : ""}`;

const LOGGER_CODE_EXAMPLE = `import { DevToolsLogger } from "@ledgerhq/device-management-kit-devtools-core";

const dmk = new DeviceManagementKitBuilder()
  .addLogger(new DevToolsLogger(connector))
  .build();`;

export const Logger: React.FC<Props> = ({
  logs,
  clearLogs,
  isConnected = true,
  onExplain,
}) => {
  const [nonce, setNonce] = React.useState(0);
  const [pausedLogs, setPausedLogs] = React.useState<LogData[] | null>(null);
  const visibleLogs = pausedLogs ?? logs;
  const { options, setOptions, displayedLogs, uniqueTags } =
    useLogsDataAndOptions({
      logs: visibleLogs,
    });

  const [newestFirst, setNewestFirst] = React.useState(false);
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizing>({});
  const data = useMemo(
    () => (newestFirst ? [...displayedLogs].reverse() : displayedLogs),
    [displayedLogs, newestFirst],
  );

  const [selected, setSelected] = React.useState<Set<LogData>>(new Set());
  // Read through refs so a new log does not re-render every row's select handler
  const dataRef = useRef(data);
  dataRef.current = data;
  // The anchor is the log itself: filters, sorting and new logs move its index
  const lastSelectedRef = useRef<LogData | null>(null);
  const selectLog = useCallback((index: number, extend: boolean) => {
    const rows = dataRef.current;
    const log = rows[index];
    if (!log) return;
    const last = lastSelectedRef.current
      ? rows.indexOf(lastSelectedRef.current)
      : -1;
    lastSelectedRef.current = log;
    setSelected((previous) => {
      const next = new Set(previous);
      if (extend && last >= 0) {
        for (let i = Math.min(last, index); i <= Math.max(last, index); i++) {
          next.add(rows[i]!);
        }
      } else if (!next.delete(log)) {
        next.add(log);
      }
      return next;
    });
  }, []);
  const { onRowMouseDown, onRowMouseEnter } = useDragSelect(
    (index) => dataRef.current[index],
    (log) => dataRef.current.indexOf(log),
    selected,
    setSelected,
    (log) => {
      lastSelectedRef.current = log;
    },
  );
  const clearSelection = useCallback(() => {
    setSelected(new Set());
    lastSelectedRef.current = null;
  }, []);
  const selectedLogs = useMemo(
    () => visibleLogs.filter((log) => selected.has(log)),
    [visibleLogs, selected],
  );

  // Track previous displayedLogs length to detect significant shrinking (e.g., from filtering)
  const prevDisplayedLogsLengthRef = useRef(displayedLogs.length);

  useEffect(() => {
    const prevLength = prevDisplayedLogsLengthRef.current;
    const currentLength = displayedLogs.length;
    prevDisplayedLogsLengthRef.current = currentLength;

    // If data shrunk significantly (e.g. a new filter), remount LogsTable to follow the latest logs again
    if (
      currentLength < prevLength * 0.5 ||
      (currentLength < 100 && currentLength < prevLength)
    ) {
      setNonce((prev) => prev + 1);
    }
  }, [displayedLogs.length]);

  // Search state
  const {
    searchQuery,
    setSearchQuery,
    matchIndices,
    currentMatchIndex,
    currentMatchRowIndex,
    goToNext,
    goToPrevious,
    goToFirst,
    goToLast,
  } = useSearchState(data);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts (Ctrl/Cmd+F, Ctrl/Cmd+K, Ctrl/Cmd+G / Ctrl/Cmd+Shift+G)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const root = rootRef.current;
      // Only while the Logger is on screen, and never over typing in another view's field
      if (!root || root.offsetParent === null) return;
      const field = (e.target as Element | null)?.closest?.(
        "input, textarea, select, [contenteditable='true']",
      );
      if (field && !root.contains(field)) return;
      // Ctrl/Cmd+F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      // Ctrl/Cmd+K to focus filter
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        filterInputRef.current?.focus();
        filterInputRef.current?.select();
      }
      // Ctrl/Cmd+G / Ctrl/Cmd+Shift+G for navigation
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevious();
        } else {
          goToNext();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrevious]);

  const tableKey = nonce;

  // Memoize highlightedIndices to avoid new Set on every render
  const highlightedIndices = useMemo(
    () => new Set(matchIndices),
    [matchIndices],
  );

  const onClickClearLogs = useCallback(() => {
    clearLogs();
    clearSelection();
    setPausedLogs((previous) => previous && []);
    setNonce((prevNonce) => prevNonce + 1);
  }, [clearLogs, clearSelection]);

  const downloadLogs = useCallback(() => {
    const logsToExport = logs.map((log) => {
      const { payload, ...rest } = log;
      return rest;
    });
    const blob = new Blob([JSON.stringify(logsToExport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-sdk-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  if (!isConnected) {
    return (
      <NotConnectedMessage
        title="Logger not connected"
        description={
          <>
            To enable logging, add <code>DevToolsLogger</code> to your DMK
            builder:
          </>
        }
        codeExample={LOGGER_CODE_EXAMPLE}
      />
    );
  }

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <LoggerToolbar
        clearLogs={onClickClearLogs}
        downloadLogs={downloadLogs}
        options={options}
        setOptions={setOptions}
        paused={pausedLogs !== null}
        onTogglePaused={() => setPausedLogs(pausedLogs ? null : logs)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        matchCount={matchIndices.length}
        currentMatchIndex={currentMatchIndex}
        onSearchNext={goToNext}
        onSearchPrevious={goToPrevious}
        onSearchFirst={goToFirst}
        onSearchLast={goToLast}
        searchInputRef={searchInputRef}
        filterInputRef={filterInputRef}
      />
      {/* Scrolled by the rows, so the headings stay above their columns */}
      <div ref={headerScrollRef} className="shrink-0 overflow-hidden">
        <div className="min-w-fit">
          <TableHeader
            options={options}
            setOptions={setOptions}
            uniqueTags={uniqueTags}
            newestFirst={newestFirst}
            onToggleSort={() => setNewestFirst(!newestFirst)}
            columnSizing={columnSizing}
            onColumnSizingChange={setColumnSizing}
          >
            <LogCounts
              paused={pausedLogs !== null}
              total={visibleLogs.length}
              displayed={displayedLogs.length}
            />
          </TableHeader>
        </div>
      </div>
      <LogsTable
        data={data}
        key={`${tableKey}-${newestFirst}`}
        highlightedIndices={highlightedIndices}
        currentHighlightIndex={currentMatchRowIndex}
        scrollToIndex={currentMatchRowIndex}
        follow={pausedLogs === null && !newestFirst}
        newestFirst={newestFirst}
        columnSizing={columnSizing}
        onHorizontalScroll={(scrollLeft) => {
          if (headerScrollRef.current) {
            headerScrollRef.current.scrollLeft = scrollLeft;
          }
        }}
        selected={selected}
        onSelect={selectLog}
        onRowMouseDown={onRowMouseDown}
        onRowMouseEnter={onRowMouseEnter}
      />
      {selectedLogs.length > 0 && (
        <SelectionBar
          label={`${selectedLogs.length} ${selectedLogs.length === 1 ? "log" : "logs"} selected`}
          detail={`${formatTime(selectedLogs[0]!.timestamp)} → ${formatTime(selectedLogs.at(-1)!.timestamp)} · shift-click to extend`}
          onClear={clearSelection}
          onExplain={() =>
            onExplain({
              context: selectedLogs.map(toContextLine).join("\n"),
              summary: `${selectedLogs.length} ${selectedLogs.length === 1 ? "log" : "logs"}`,
            })
          }
        />
      )}
    </div>
  );
};
