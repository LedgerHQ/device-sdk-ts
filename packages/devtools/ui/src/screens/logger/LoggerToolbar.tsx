import React from "react";
import { IconButton } from "@ledgerhq/lumen-ui-react";
import { Download, Trash } from "@ledgerhq/lumen-ui-react/symbols";

import { WithTooltip } from "../../components/WithTooltip";
import { FilterInput } from "./FilterInput";
import { type LoggerOptions } from "./LoggerOptions";
import { PauseButton } from "./PauseButton";
import { SearchInput } from "./SearchInput";

export const LoggerToolbar: React.FC<{
  clearLogs: () => void;
  downloadLogs: () => void;
  options: LoggerOptions;
  setOptions: (options: LoggerOptions) => void;
  paused: boolean;
  onTogglePaused: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  onSearchNext: () => void;
  onSearchPrevious: () => void;
  onSearchFirst: () => void;
  onSearchLast: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  filterInputRef?: React.RefObject<HTMLInputElement>;
}> = ({
  clearLogs,
  downloadLogs,
  options,
  setOptions,
  paused,
  onTogglePaused,
  searchQuery,
  onSearchChange,
  matchCount,
  currentMatchIndex,
  onSearchNext,
  onSearchPrevious,
  onSearchFirst,
  onSearchLast,
  searchInputRef,
  filterInputRef,
}) => (
  <div className="flex h-56 shrink-0 items-center gap-12 border-b border-muted-subtle px-12">
    <FilterInput
      value={options.filterText}
      onChange={(filterText) => setOptions({ ...options, filterText })}
      inputRef={filterInputRef}
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
    <span className="flex-1" />
    <div className="flex gap-6">
      <PauseButton paused={paused} onToggle={onTogglePaused} />
      <WithTooltip label="Clear logs" side="bottom">
        <IconButton
          aria-label="Clear logs"
          icon={Trash}
          size="xs"
          appearance="transparent"
          className="rounded-sm"
          onClick={clearLogs}
        />
      </WithTooltip>
      <WithTooltip label="Export logs" side="bottom">
        <IconButton
          aria-label="Export logs"
          icon={Download}
          size="xs"
          appearance="transparent"
          className="rounded-sm"
          onClick={downloadLogs}
        />
      </WithTooltip>
    </div>
  </div>
);
