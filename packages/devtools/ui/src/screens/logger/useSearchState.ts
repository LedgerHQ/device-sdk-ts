import { useCallback, useMemo, useState } from "react";

import { matchesFilter, parseFilterQuery } from "./filterUtils";
import { type LogData } from "./types";

/**
 * Hook to manage search state and compute matches.
 *
 * Features:
 * - Computes matching row indices using filterUtils
 * - Tracks current match index for navigation
 * - Provides navigation functions (next/previous) with wraparound
 *
 * @param logs - The logs to search through (typically displayedLogs after filtering)
 * @returns Search state and navigation functions
 */
export const useSearchState = (logs: LogData[]) => {
  const [searchQuery, setSearchQuery] = useState("");
  // The log itself: new logs and the log cap move the indices under it
  const [currentMatch, setCurrentMatch] = useState<LogData | null>(null);

  // Compute matching row indices using filterUtils
  const matchIndices = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return [];

    const tokens = parseFilterQuery(trimmed);
    if (tokens.length === 0) return [];

    return logs
      .map((log, index) => (matchesFilter(log, tokens) ? index : -1))
      .filter((i) => i !== -1);
  }, [logs, searchQuery]);

  // Falls back to the first match when the current one is gone
  const found = matchIndices.findIndex((index) => logs[index] === currentMatch);
  const currentMatchIndex = Math.max(0, found);

  const goTo = useCallback(
    (position: number) => {
      const index = matchIndices[position];
      if (index !== undefined) setCurrentMatch(logs[index] ?? null);
    },
    [logs, matchIndices],
  );

  // Navigate to next match (wraps around)
  const goToNext = useCallback(() => {
    goTo(
      currentMatchIndex >= matchIndices.length - 1 ? 0 : currentMatchIndex + 1,
    );
  }, [goTo, currentMatchIndex, matchIndices.length]);

  // Navigate to previous match (wraps around)
  const goToPrevious = useCallback(() => {
    goTo(
      currentMatchIndex <= 0 ? matchIndices.length - 1 : currentMatchIndex - 1,
    );
  }, [goTo, currentMatchIndex, matchIndices.length]);

  // Navigate to first match
  const goToFirst = useCallback(() => goTo(0), [goTo]);

  // Navigate to last match
  const goToLast = useCallback(
    () => goTo(matchIndices.length - 1),
    [goTo, matchIndices.length],
  );

  return {
    searchQuery,
    setSearchQuery,
    matchIndices,
    currentMatchIndex,
    currentMatchRowIndex: matchIndices[currentMatchIndex],
    goToNext,
    goToPrevious,
    goToFirst,
    goToLast,
  };
};
