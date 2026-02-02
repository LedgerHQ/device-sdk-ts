import React, { useCallback, useRef, useState } from "react";
import { Icons } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { InputContainer, InputWrapper, StyledInput } from "./inputStyles";

const MatchCounter = styled.span`
  font-size: 11px;
  color: #666;
  white-space: nowrap;
  padding: 0 4px;
`;

const NavButton = styled.button`
  background: none;
  border: none;
  border-left: 1px solid #eee;
  padding: 4px 6px;
  cursor: pointer;
  opacity: 0.65;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    opacity: 1;
    background-color: #f5f5f5;
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
    &:hover {
      background-color: transparent;
    }
  }
`;

const ClearButton = styled.button`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  opacity: 0.5;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    opacity: 1;
  }
`;

const DoubleChevronWrapper = styled.span`
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 0;
  transform: scale(0.85);

  svg {
    display: block;
  }

  svg:first-child {
    margin-bottom: -8px;
  }
`;

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
  const [isFocused, setIsFocused] = useState(false);

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
    <InputContainer>
      <InputWrapper $focused={isFocused}>
        <StyledInput
          ref={effectiveRef}
          type="text"
          placeholder="Search (Ctrl/Cmd+F)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <ClearButton onClick={handleClear} title="Clear search">
            <Icons.Close size="XS" />
          </ClearButton>
        )}
        {value && (
          <MatchCounter>
            {displayIndex}/{matchCount}
          </MatchCounter>
        )}
        <NavButton
          onClick={onPrevious}
          disabled={!hasMatches}
          title="Previous match (Shift+Enter)"
        >
          <Icons.ChevronBigTop size="XS" />
        </NavButton>
        <NavButton
          onClick={onNext}
          disabled={!hasMatches}
          title="Next match (Enter)"
        >
          <Icons.ChevronBigBottom size="XS" />
        </NavButton>
        <NavButton onClick={onFirst} disabled={!hasMatches} title="First match">
          <DoubleChevronWrapper>
            <Icons.ChevronBigTop size="XS" />
            <Icons.ChevronBigTop size="XS" />
          </DoubleChevronWrapper>
        </NavButton>
        <NavButton onClick={onLast} disabled={!hasMatches} title="Last match">
          <DoubleChevronWrapper>
            <Icons.ChevronBigBottom size="XS" />
            <Icons.ChevronBigBottom size="XS" />
          </DoubleChevronWrapper>
        </NavButton>
      </InputWrapper>
    </InputContainer>
  );
};
