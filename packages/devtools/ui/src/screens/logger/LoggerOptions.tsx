import React from "react";
import { Checkbox } from "@ledgerhq/lumen-ui-react";

import { type LogData } from "./types";

export type LoggerOptions = {
  activeLevels: Record<LogData["verbosity"], boolean>;
  showTimestamp: boolean;
  showTag: boolean;
  includeTags: Set<string>;
  filterText: string;
};

type LoggerProps = {
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
  includeTags: new Set(),
  filterText: "",
};

const Option: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex cursor-pointer items-center gap-8 body-3">
    <Checkbox checked={checked} onCheckedChange={onChange} />
    {label}
  </label>
);

const OptionGroup: React.FC<React.PropsWithChildren<{ title: string }>> = ({
  title,
  children,
}) => (
  <div className="flex flex-col gap-8">
    <h5 className="body-2-semi-bold whitespace-nowrap">{title}</h5>
    <div className="flex flex-wrap gap-x-16 gap-y-8">{children}</div>
  </div>
);

export const LoggerOptionsView: React.FC<LoggerProps> = ({
  options,
  setOptions,
  uniqueTags,
}) => {
  return (
    <div className="flex max-h-480 flex-col gap-24 overflow-auto p-16">
      <OptionGroup title="Log levels">
        <Option
          label="All"
          checked={Object.values(options.activeLevels).every(Boolean)}
          onChange={(checked) => {
            const newActiveLevels = Object.fromEntries(
              Object.keys(options.activeLevels).map((level) => [
                level,
                checked,
              ]),
            );
            setOptions({
              ...options,
              activeLevels: newActiveLevels as LoggerOptions["activeLevels"],
            });
          }}
        />
        {["debug", "info", "warning", "error", "fatal"].map((level) => (
          <Option
            key={level}
            label={level}
            checked={
              options.activeLevels[level as LogData["verbosity"]] ?? false
            }
            onChange={(checked) => {
              setOptions({
                ...options,
                activeLevels: {
                  ...options.activeLevels,
                  [level as LogData["verbosity"]]: checked,
                },
              });
            }}
          />
        ))}
      </OptionGroup>
      <OptionGroup title="Tags">
        <Option
          label="All"
          checked={uniqueTags.size === options.includeTags.size}
          onChange={(checked) => {
            if (checked) {
              uniqueTags.forEach((tag) => options.includeTags.add(tag));
            } else {
              options.includeTags.clear();
            }
            setOptions({ ...options });
          }}
        />
        {Array.from(uniqueTags).map((tag) => (
          <Option
            key={tag}
            label={tag}
            checked={options.includeTags.has(tag)}
            onChange={(checked) => {
              if (checked) {
                options.includeTags.add(tag);
              } else {
                options.includeTags.delete(tag);
              }
              setOptions({ ...options });
            }}
          />
        ))}
      </OptionGroup>
    </div>
  );
};
