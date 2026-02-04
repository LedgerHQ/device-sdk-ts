import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "devtools-logger-recent-filters";
const MAX_RECENT_FILTERS = 10;
const DEBOUNCE_MS = 15000; // 15 seconds

/**
 * Loads recent filters from localStorage.
 */
function loadRecentFilters(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === "string",
        );
      }
    }
  } catch {
    // Ignore errors, return empty array
  }
  return [];
}

/**
 * Saves recent filters to localStorage.
 */
function saveRecentFilters(filters: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore errors (e.g., storage full, private mode)
  }
}

/**
 * Hook to manage recent filters with localStorage persistence.
 *
 * Features:
 * - Loads recent filters from localStorage on mount
 * - Auto-saves current filter after 15 seconds of no changes (debounced)
 * - Provides manual add/remove functions
 * - Caps at MAX_RECENT_FILTERS items
 *
 * @param currentFilter - The current filter value (used for debounced auto-save)
 * @returns Object with recentFilters array and add/remove functions
 */
export const useRecentFilters = (currentFilter: string) => {
  const [recentFilters, setRecentFilters] = useState<string[]>(() =>
    loadRecentFilters(),
  );

  // Track the last saved filter to avoid duplicate saves
  const lastSavedFilterRef = useRef<string>("");

  /**
   * Adds a filter to the recent list.
   * - Moves to top if already exists
   * - Caps at MAX_RECENT_FILTERS
   */
  const addFilter = useCallback((filter: string) => {
    if (!filter.trim()) return;

    setRecentFilters((prev) => {
      // Remove if already exists
      const filtered = prev.filter((f) => f !== filter);
      // Add to beginning
      const updated = [filter, ...filtered].slice(0, MAX_RECENT_FILTERS);
      // Persist
      saveRecentFilters(updated);
      return updated;
    });
  }, []);

  /**
   * Removes a filter from the recent list.
   */
  const removeFilter = useCallback((filter: string) => {
    setRecentFilters((prev) => {
      const updated = prev.filter((f) => f !== filter);
      // Persist
      saveRecentFilters(updated);
      return updated;
    });
  }, []);

  // Auto-save with debounce
  useEffect(() => {
    const trimmedFilter = currentFilter.trim();

    // Don't save empty filters or if already saved
    if (!trimmedFilter || trimmedFilter === lastSavedFilterRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      addFilter(trimmedFilter);
      lastSavedFilterRef.current = trimmedFilter;
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentFilter, addFilter]);

  return { recentFilters, addFilter, removeFilter };
};
