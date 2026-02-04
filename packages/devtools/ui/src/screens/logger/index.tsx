import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Divider, Flex } from "@ledgerhq/react-ui";

import { NotConnectedMessage } from "../../shared/NotConnectedMessage";
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
  const { options, setOptions, displayedLogs, uniqueTags } =
    useLogsDataAndOptions({
      logs,
    });

  const data = displayedLogs;

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
  } = useSearchState(displayedLogs);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts (Ctrl/Cmd+F, Ctrl/Cmd+G / Ctrl/Cmd+Shift+G)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd+F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
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
    <Flex flex={1} flexDirection="column" minHeight={0} overflow="hidden">
      <Flex flexDirection="column" px={6} py={2} flexShrink={0}>
        <LoggerToolbar
          clearLogs={onClickClearLogs}
          downloadLogs={downloadLogs}
          options={options}
          setOptions={setOptions}
          uniqueTags={uniqueTags}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          matchCount={matchIndices.length}
          currentMatchIndex={currentMatchIndex}
          onSearchNext={goToNext}
          onSearchPrevious={goToPrevious}
          onSearchFirst={goToFirst}
          onSearchLast={goToLast}
          searchInputRef={searchInputRef}
        />
      </Flex>
      <Divider mb={3} flexShrink={0} />
      <LogsTable
        data={data}
        key={tableKey}
        highlightedIndices={highlightedIndices}
        currentHighlightIndex={currentMatchRowIndex}
        scrollToIndex={currentMatchRowIndex}
      />
    </Flex>
  );
};
