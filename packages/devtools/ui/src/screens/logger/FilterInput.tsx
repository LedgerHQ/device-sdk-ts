import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Close } from "@ledgerhq/lumen-ui-react/symbols";

import {
  INPUT,
  INPUT_CONTAINER,
  INPUT_ICON_BUTTON,
  INPUT_WRAPPER,
  SHORTCUT_HINT,
  SHORTCUT_MODIFIER,
} from "./inputStyles";
import { useRecentFilters } from "./useRecentFilters";

type FilterInputProps = {
  value: string;
  onChange: (value: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
};

export const FilterInput: React.FC<FilterInputProps> = ({
  value,
  onChange,
  inputRef: externalInputRef,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const { recentFilters, removeFilter } = useRecentFilters(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? localInputRef;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleDropdown = useCallback(() => {
    setShowDropdown((prev) => {
      if (!prev) {
        setHighlightedIndex(-1);
      }
      return !prev;
    });
  }, []);

  const handleSelectFilter = useCallback(
    (filter: string) => {
      onChange(filter);
      setShowDropdown(false);
      setHighlightedIndex(-1);
      inputRef.current?.focus();
    },
    [onChange, inputRef],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        if (showDropdown) {
          setShowDropdown(false);
          setHighlightedIndex(-1);
        } else {
          inputRef.current?.blur();
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (showDropdown && recentFilters.length > 0) {
          setHighlightedIndex((prev) =>
            prev < recentFilters.length - 1 ? prev + 1 : prev,
          );
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (showDropdown) {
          setHighlightedIndex((prev) => (prev > -1 ? prev - 1 : -1));
        }
      } else if (e.key === "Enter") {
        if (
          showDropdown &&
          highlightedIndex >= 0 &&
          recentFilters[highlightedIndex]
        ) {
          e.preventDefault();
          handleSelectFilter(recentFilters[highlightedIndex]);
        }
      }
    },
    [
      showDropdown,
      recentFilters,
      highlightedIndex,
      handleSelectFilter,
      inputRef,
    ],
  );

  const handleRemoveFilter = useCallback(
    (e: React.MouseEvent, filter: string) => {
      e.stopPropagation();
      removeFilter(filter);
    },
    [removeFilter],
  );

  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange, inputRef]);

  return (
    <div className={INPUT_CONTAINER} ref={containerRef}>
      <div className={INPUT_WRAPPER}>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="shrink-0 text-muted"
          aria-hidden="true"
        >
          <path d="M3 5h18l-7 8v6l-4-2v-4z" />
        </svg>
        <input
          ref={inputRef}
          className={INPUT}
          type="text"
          placeholder="Filter"
          aria-label="Filter logs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {value ? (
          <button
            className={INPUT_ICON_BUTTON}
            onClick={handleClear}
            title="Clear filter"
          >
            <Close size={12} />
          </button>
        ) : (
          <kbd className={SHORTCUT_HINT}>{SHORTCUT_MODIFIER}K</kbd>
        )}
        <button
          type="button"
          className={`${INPUT_ICON_BUTTON} ${showDropdown ? "text-base" : ""}`}
          onClick={toggleDropdown}
          title="Recent filters"
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {showDropdown && (
        <div className="absolute inset-x-0 top-full z-1000 mt-4 max-h-320 overflow-y-auto rounded-sm border border-muted-subtle bg-canvas-sheet py-4 shadow-xl">
          <div className="border-b border-muted-subtle px-10 py-6 body-4-semi-bold text-muted uppercase">
            Recent filters
          </div>
          {recentFilters.length === 0 ? (
            <div className="px-10 py-12 text-center body-3 text-muted">
              No recent filters
            </div>
          ) : (
            recentFilters.map((filter, index) => (
              <div
                key={filter}
                className={`group flex cursor-pointer items-center justify-between px-10 py-8 font-mono! body-3 hover:bg-base-transparent-hover ${index === highlightedIndex ? "bg-active-subtle" : ""}`}
                onClick={() => handleSelectFilter(filter)}
              >
                <span className="flex-1 truncate">{filter}</span>
                <button
                  className="ml-8 flex cursor-pointer items-center text-muted opacity-50 group-hover:opacity-100 hover:text-base"
                  onClick={(e) => handleRemoveFilter(e, filter)}
                  title="Remove from recent"
                >
                  <Close size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
