import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

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

  // Reset current match index when matches change
  useEffect(() => {
    if (matchIndices.length === 0) {
      setCurrentMatchIndex(0);
    } else if (currentMatchIndex >= matchIndices.length) {
      setCurrentMatchIndex(matchIndices.length - 1);
    }
  }, [matchIndices.length, currentMatchIndex]);

  // Navigate to next match (wraps around)
  const goToNext = useCallback(() => {
    if (matchIndices.length === 0) return;
    setCurrentMatchIndex((prev) =>
      prev >= matchIndices.length - 1 ? 0 : prev + 1,
    );
  }, [matchIndices.length]);

  // Navigate to previous match (wraps around)
  const goToPrevious = useCallback(() => {
    if (matchIndices.length === 0) return;
    setCurrentMatchIndex((prev) =>
      prev <= 0 ? matchIndices.length - 1 : prev - 1,
    );
  }, [matchIndices.length]);

  // Navigate to first match
  const goToFirst = useCallback(() => {
    if (matchIndices.length === 0) return;
    setCurrentMatchIndex(0);
  }, [matchIndices.length]);

  // Navigate to last match
  const goToLast = useCallback(() => {
    if (matchIndices.length === 0) return;
    setCurrentMatchIndex(matchIndices.length - 1);
  }, [matchIndices.length]);

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
