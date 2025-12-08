import React, { useMemo } from "react";

import { defaultLoggerOptions, type LoggerOptions } from "./LoggerOptions";
import { type LogData } from "./types";

const maxDisplayedLogs = Number.POSITIVE_INFINITY;

export const useLogsDataAndOptions = ({ logs }: { logs: LogData[] }) => {
  const [options, setOptions] =
    React.useState<LoggerOptions>(defaultLoggerOptions);

  const displayedLogs = useMemo(() => {
    const filteredLogs = logs.filter((log) => {
      if (!options.activeLevels[log.verbosity]) {
        return false;
      }
      if (options.includeTags.size > 0) {
        if (!options.includeTags.has(log.tag)) {
          return false;
        }
      }
      return true;
    });
    return filteredLogs.length > maxDisplayedLogs
      ? filteredLogs.slice(-maxDisplayedLogs)
      : filteredLogs;
  }, [logs, options]);

  const uniqueTagsRef = React.useRef<Set<string>>(new Set());
  const uniqueTags = useMemo(() => {
    logs.forEach((log) => {
      uniqueTagsRef.current.add(log.tag);
    });
    return uniqueTagsRef.current;
  }, [logs]);

  return { displayedLogs, options, setOptions, uniqueTags };
};
