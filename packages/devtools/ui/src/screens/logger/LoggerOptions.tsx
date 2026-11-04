import React from "react";
import { Checkbox } from "@ledgerhq/lumen-ui-react";

import { type LogData } from "./types";

export type LoggerOptions = {
  activeLevels: Record<LogData["verbosity"], boolean>;
  showTimestamp: boolean;
  showTag: boolean;
  excludeTags: Set<string>;
  filterText: string;
};

type FilterProps = {
  options: LoggerOptions;
  setOptions: (options: LoggerOptions) => void;
  uniqueTags: Set<string>;
};

export const defaultLoggerOptions: LoggerOptions = {
  activeLevels: {
    debug: true,
    info: true,
    warning: true,
    error: true,
    fatal: true,
  },
  showTimestamp: true,
  showTag: true,
  excludeTags: new Set(),
  filterText: "",
};

const LEVELS: LogData["verbosity"][] = [
  "debug",
  "info",
  "warning",
  "error",
  "fatal",
];

const Option: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex cursor-pointer items-center gap-8 font-mono! body-3 whitespace-nowrap">
    <Checkbox checked={checked} onCheckedChange={onChange} />
    {label}
  </label>
);

export const isLevelFilterActive = (options: LoggerOptions) =>
  !Object.values(options.activeLevels).every(Boolean);

export const isTagFilterActive = (options: LoggerOptions) =>
  options.excludeTags.size > 0;

export const LevelFilter: React.FC<FilterProps> = ({ options, setOptions }) => (
  <>
    <Option
      label="All"
      checked={!isLevelFilterActive(options)}
      onChange={(checked) =>
        setOptions({
          ...options,
          activeLevels: Object.fromEntries(
            LEVELS.map((level) => [level, checked]),
          ) as LoggerOptions["activeLevels"],
        })
      }
    />
    {LEVELS.map((level) => (
      <Option
        key={level}
        label={level}
        checked={options.activeLevels[level] ?? false}
        onChange={(checked) =>
          setOptions({
            ...options,
            activeLevels: { ...options.activeLevels, [level]: checked },
          })
        }
      />
    ))}
  </>
);

export const TagFilter: React.FC<FilterProps> = ({
  options,
  setOptions,
  uniqueTags,
}) => {
  const setShown = (tag: string, shown: boolean) => {
    const next = new Set(options.excludeTags);
    if (shown) {
      next.delete(tag);
    } else {
      next.add(tag);
    }
    setOptions({ ...options, excludeTags: next });
  };

  return (
    <>
      <Option
        label="All"
        checked={!isTagFilterActive(options)}
        onChange={(checked) =>
          setOptions({
            ...options,
            excludeTags: checked ? new Set() : new Set(uniqueTags),
          })
        }
      />
      {Array.from(uniqueTags).map((tag) => (
        <Option
          key={tag}
          label={tag}
          checked={!options.excludeTags.has(tag)}
          onChange={(checked) => setShown(tag, checked)}
        />
      ))}
    </>
  );
};
