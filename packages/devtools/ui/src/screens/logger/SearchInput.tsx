import React, { useCallback, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Close,
  Search,
} from "@ledgerhq/lumen-ui-react/symbols";

import {
  INPUT,
  INPUT_CONTAINER,
  INPUT_ICON_BUTTON,
  INPUT_WRAPPER,
} from "./inputStyles";

const NAV_BUTTON = `${INPUT_ICON_BUTTON} border-l border-muted-subtle`;

const DoubleChevron: React.FC<{ direction: "up" | "down" }> = ({
  direction,
}) => {
  const Chevron = direction === "up" ? ChevronUp : ChevronDown;
  return (
    <span className="flex flex-col items-center leading-0 [&>svg:first-child]:-mb-8">
      <Chevron size={12} />
      <Chevron size={12} />
    </span>
  );
};

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onFirst: () => void;
  onLast: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
};

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  matchCount,
  currentMatchIndex,
  onNext,
  onPrevious,
  onFirst,
  onLast,
  inputRef,
}) => {
  const localRef = useRef<HTMLInputElement>(null);
  const effectiveRef = inputRef ?? localRef;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          onPrevious();
        } else {
          onNext();
        }
      } else if (e.key === "Escape") {
        effectiveRef.current?.blur();
      }
    },
    [onNext, onPrevious, effectiveRef],
  );

  const hasMatches = matchCount > 0;
  const displayIndex = hasMatches ? currentMatchIndex + 1 : 0;

  const handleClear = useCallback(() => {
    onChange("");
    effectiveRef.current?.focus();
  }, [onChange, effectiveRef]);

  return (
    <div className={INPUT_CONTAINER}>
      <div className={`${INPUT_WRAPPER} pl-10`}>
        <Search size={16} className="shrink-0 text-muted" />
        <input
          ref={effectiveRef}
          className={INPUT}
          type="text"
          placeholder="Search (Ctrl/Cmd+F)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <button
            className={INPUT_ICON_BUTTON}
            onClick={handleClear}
            title="Clear search"
          >
            <Close size={12} />
          </button>
        )}
        {value && (
          <span className="px-4 body-4 whitespace-nowrap text-muted">
            {displayIndex}/{matchCount}
          </span>
        )}
        <button
          className={NAV_BUTTON}
          onClick={onPrevious}
          disabled={!hasMatches}
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp size={16} />
        </button>
        <button
          className={NAV_BUTTON}
          onClick={onNext}
          disabled={!hasMatches}
          title="Next match (Enter)"
        >
          <ChevronDown size={16} />
        </button>
        <button
          className={NAV_BUTTON}
          onClick={onFirst}
          disabled={!hasMatches}
          title="First match"
        >
          <DoubleChevron direction="up" />
        </button>
        <button
          className={NAV_BUTTON}
          onClick={onLast}
          disabled={!hasMatches}
          title="Last match"
        >
          <DoubleChevron direction="down" />
        </button>
      </div>
    </div>
  );
};
