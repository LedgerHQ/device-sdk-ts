import React, { useCallback, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Close,
  Search,
} from "@ledgerhq/lumen-ui-react/symbols";

import { WithTooltip } from "../../components/WithTooltip";
import {
  INPUT,
  INPUT_ICON_BUTTON,
  INPUT_WRAPPER,
  SHORTCUT_HINT,
  SHORTCUT_MODIFIER,
} from "./inputStyles";

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
    <div className="relative w-400 shrink-0">
      <div className={INPUT_WRAPPER}>
        <Search size={16} className="shrink-0 text-muted" />
        <input
          ref={effectiveRef}
          className={INPUT}
          type="text"
          placeholder="Find"
          aria-label="Find in logs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <WithTooltip label="Clear search" side="bottom">
            <button
              aria-label="Clear search"
              className={INPUT_ICON_BUTTON}
              onClick={handleClear}
            >
              <Close size={12} />
            </button>
          </WithTooltip>
        )}
        {value ? (
          <span className="body-4 whitespace-nowrap text-muted">
            {displayIndex}/{matchCount}
          </span>
        ) : (
          <kbd className={SHORTCUT_HINT}>{SHORTCUT_MODIFIER}F</kbd>
        )}
        <WithTooltip label="Previous match (Shift+Enter)" side="bottom">
          <button
            aria-label="Previous match (Shift+Enter)"
            className={INPUT_ICON_BUTTON}
            onClick={onPrevious}
            disabled={!hasMatches}
          >
            <ChevronUp size={16} />
          </button>
        </WithTooltip>
        <WithTooltip label="Next match (Enter)" side="bottom">
          <button
            aria-label="Next match (Enter)"
            className={INPUT_ICON_BUTTON}
            onClick={onNext}
            disabled={!hasMatches}
          >
            <ChevronDown size={16} />
          </button>
        </WithTooltip>
        <WithTooltip label="First match" side="bottom">
          <button
            aria-label="First match"
            className={INPUT_ICON_BUTTON}
            onClick={onFirst}
            disabled={!hasMatches}
          >
            <DoubleChevron direction="up" />
          </button>
        </WithTooltip>
        <WithTooltip label="Last match" side="bottom">
          <button
            aria-label="Last match"
            className={INPUT_ICON_BUTTON}
            onClick={onLast}
            disabled={!hasMatches}
          >
            <DoubleChevron direction="down" />
          </button>
        </WithTooltip>
      </div>
    </div>
  );
};
