import React from "react";
import {
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@ledgerhq/lumen-ui-react";
import { Download, Settings, Trash } from "@ledgerhq/lumen-ui-react/symbols";

import { FilterInput } from "./FilterInput";
import { type LoggerOptions, LoggerOptionsView } from "./LoggerOptions";
import { SearchInput } from "./SearchInput";

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
  <div className="flex flex-1 items-center gap-8">
    <IconButton
      aria-label="Clear logs"
      title="Clear logs"
      icon={Trash}
      size="sm"
      appearance="no-background"
      onClick={clearLogs}
    />
    <Popover>
      <PopoverTrigger
        aria-label="Log options"
        title="Log options"
        render={
          <button className="flex size-40 shrink-0 cursor-pointer items-center justify-center rounded-full text-base transition-colors hover:bg-base-transparent-hover active:bg-base-transparent-pressed">
            <Settings size={20} />
          </button>
        }
      />
      <PopoverContent side="bottom" align="start" width="fixed">
        <LoggerOptionsView
          options={options}
          setOptions={setOptions}
          uniqueTags={uniqueTags}
        />
      </PopoverContent>
    </Popover>
    <IconButton
      aria-label="Download logs"
      title="Download logs"
      icon={Download}
      size="sm"
      appearance="no-background"
      onClick={downloadLogs}
    />
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
  </div>
);
