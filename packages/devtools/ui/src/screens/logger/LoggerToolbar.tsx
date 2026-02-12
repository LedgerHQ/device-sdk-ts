import React from "react";
import { Flex, Icons, Tooltip } from "@ledgerhq/react-ui";
import styled from "styled-components";

import { FilterInput } from "./FilterInput";
import { type LoggerOptions, LoggerOptionsView } from "./LoggerOptions";
import { SearchInput } from "./SearchInput";

const ButtonContainer = styled.div`
  opacity: 0.65;
  cursor: pointer;
  flex-shrink: 0;
  &:hover {
    opacity: 1;
  }
`;

export const LoggerToolbar: React.FC<{
  clearLogs: () => void;
  downloadLogs: () => void;
  options: LoggerOptions;
  setOptions: (options: LoggerOptions) => void;
  uniqueTags: Set<string>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  onSearchNext: () => void;
  onSearchPrevious: () => void;
  onSearchFirst: () => void;
  onSearchLast: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
}> = ({
  clearLogs,
  downloadLogs,
  options,
  setOptions,
  uniqueTags,
  searchQuery,
  onSearchChange,
  matchCount,
  currentMatchIndex,
  onSearchNext,
  onSearchPrevious,
  onSearchFirst,
  onSearchLast,
  searchInputRef,
}) => (
  <Flex flexDirection="row" columnGap={5} alignItems="center" flex={1}>
    <ButtonContainer onClick={clearLogs}>
      <Icons.DeleteStop size="S" />
    </ButtonContainer>
    <Tooltip
      trigger="click"
      placement="bottom"
      interactive
      content={
        <LoggerOptionsView
          options={options}
          setOptions={setOptions}
          uniqueTags={uniqueTags}
        />
      }
    >
      <ButtonContainer>
        <Icons.Settings size="S" />
      </ButtonContainer>
    </Tooltip>
    <ButtonContainer onClick={downloadLogs}>
      <Icons.Download size="S" />
    </ButtonContainer>
    <FilterInput
      value={options.filterText}
      onChange={(filterText) => setOptions({ ...options, filterText })}
    />
    <SearchInput
      value={searchQuery}
      onChange={onSearchChange}
      matchCount={matchCount}
      currentMatchIndex={currentMatchIndex}
      onNext={onSearchNext}
      onPrevious={onSearchPrevious}
      onFirst={onSearchFirst}
      onLast={onSearchLast}
      inputRef={searchInputRef}
    />
  </Flex>
);
