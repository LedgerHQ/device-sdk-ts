import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { type ColumnSizingState } from "@tanstack/react-table";

import { TableHeader } from "./logsTable/TableHeader";
import { NotConnectedMessage } from "../../shared/NotConnectedMessage";
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
};

const LOGGER_CODE_EXAMPLE = `import { DevToolsLogger } from "@ledgerhq/device-management-kit-devtools-core";

const dmk = new DeviceManagementKitBuilder()
  .addLogger(new DevToolsLogger(connector))
  .build();`;

export const Logger: React.FC<Props> = ({
  logs,
  clearLogs,
  isConnected = true,
}) => {
  const [nonce, setNonce] = React.useState(0);
  const [pausedLogs, setPausedLogs] = React.useState<LogData[] | null>(null);
  const visibleLogs = pausedLogs ?? logs;
  const { options, setOptions, displayedLogs, uniqueTags } =
    useLogsDataAndOptions({
      logs: visibleLogs,
    });

  const [newestFirst, setNewestFirst] = React.useState(false);
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const data = useMemo(
    () => (newestFirst ? [...displayedLogs].reverse() : displayedLogs),
    [displayedLogs, newestFirst],
  );

  // Track previous displayedLogs length to detect significant shrinking (e.g., from filtering)
  const prevDisplayedLogsLengthRef = useRef(displayedLogs.length);

  useEffect(() => {
    const prevLength = prevDisplayedLogsLengthRef.current;
    const currentLength = displayedLogs.length;
    prevDisplayedLogsLengthRef.current = currentLength;

    // If data shrunk significantly, increment nonce to force LogsTable remount
    // This resets the virtualizer state which can get corrupted when filtering
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

  // Keyboard shortcuts (Ctrl/Cmd+F, Ctrl/Cmd+K, Ctrl/Cmd+G / Ctrl/Cmd+Shift+G)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    setPausedLogs((previous) => previous && []);
    setNonce((prevNonce) => prevNonce + 1);
  }, [clearLogs]);

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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
      <LogsTable
        data={data}
        key={`${tableKey}-${newestFirst}`}
        highlightedIndices={highlightedIndices}
        currentHighlightIndex={currentMatchRowIndex}
        scrollToIndex={currentMatchRowIndex}
        follow={pausedLogs === null && !newestFirst}
        columnSizing={columnSizing}
        onColumnSizingChange={setColumnSizing}
      />
    </div>
  );
};
