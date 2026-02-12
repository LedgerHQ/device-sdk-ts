import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icons } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { InputContainer, InputWrapper, StyledInput } from "./inputStyles";
import { useRecentFilters } from "./useRecentFilters";

const Dropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
`;

const DropdownHeader = styled.div`
  padding: 6px 10px;
  font-size: 10px;
  color: #666;
  text-transform: uppercase;
  border-bottom: 1px solid #eee;
`;

const DropdownItem = styled.div<{ $highlighted?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  font-size: 12px;
  font-family: monospace;
  color: #333;
  cursor: pointer;
  background-color: ${({ $highlighted }) =>
    $highlighted ? "#e8f0fe" : "transparent"};

  &:hover {
    background-color: ${({ $highlighted }) =>
      $highlighted ? "#e8f0fe" : "#f5f5f5"};
  }
`;

const FilterText = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  padding: 2px;
  margin-left: 8px;
  cursor: pointer;
  opacity: 0.5;
  color: #666;
  display: flex;
  align-items: center;

  &:hover {
    opacity: 1;
  }
`;

const EmptyMessage = styled.div`
  padding: 12px 10px;
  font-size: 12px;
  color: #999;
  text-align: center;
`;

const HistoryButton = styled.button<{ $active?: boolean }>`
  background: none;
  border: none;
  padding: 4px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: ${({ $active }) => ($active ? "#333" : "#999")};

  &:hover {
    color: #333;
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

type FilterInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export const FilterInput: React.FC<FilterInputProps> = ({
  value,
  onChange,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const { recentFilters, removeFilter } = useRecentFilters(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const toggleDropdown = useCallback(() => {
    setShowDropdown((prev) => {
      if (!prev) {
        setHighlightedIndex(-1);
      }
      return !prev;
    });
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleSelectFilter = useCallback(
    (filter: string) => {
      onChange(filter);
      setShowDropdown(false);
      setHighlightedIndex(-1);
      inputRef.current?.focus();
    },
    [onChange],
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
    [showDropdown, recentFilters, highlightedIndex, handleSelectFilter],
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
  }, [onChange]);

  return (
    <InputContainer ref={containerRef}>
      <InputWrapper $focused={isFocused}>
        <StyledInput
          ref={inputRef}
          type="text"
          placeholder="Filter (e.g. error, -debug, /regex/)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <ClearButton onClick={handleClear} title="Clear filter">
            <Icons.Close size="XS" />
          </ClearButton>
        )}
        <HistoryButton
          type="button"
          onClick={toggleDropdown}
          $active={showDropdown}
          title="Recent filters"
        >
          <Icons.ChevronBigBottom size="XS" />
        </HistoryButton>
      </InputWrapper>
      {showDropdown && (
        <Dropdown>
          <DropdownHeader>Recent filters</DropdownHeader>
          {recentFilters.length === 0 ? (
            <EmptyMessage>No recent filters</EmptyMessage>
          ) : (
            recentFilters.map((filter, index) => (
              <DropdownItem
                key={filter}
                $highlighted={index === highlightedIndex}
                onClick={() => handleSelectFilter(filter)}
              >
                <FilterText>{filter}</FilterText>
                <RemoveButton
                  onClick={(e) => handleRemoveFilter(e, filter)}
                  title="Remove from recent"
                >
                  <Icons.Close size="XS" />
                </RemoveButton>
              </DropdownItem>
            ))
          )}
        </Dropdown>
      )}
    </InputContainer>
  );
};
