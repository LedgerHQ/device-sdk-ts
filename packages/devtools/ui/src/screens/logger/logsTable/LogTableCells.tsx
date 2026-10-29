import React from "react";
import { Inspector } from "react-inspector";
import { useTheme } from "@ledgerhq/lumen-ui-react";

import { type LogData } from "../types";

type Verbosity = LogData["verbosity"];

const verbosityTextColor: Record<Verbosity, string> = {
  debug: "text-muted",
  info: "text-base",
  warning: "text-warning",
  error: "text-error",
  fatal: "text-error",
};

const LogText: React.FC<
  React.PropsWithChildren<{ verbosity: Verbosity; className?: string }>
> = ({ verbosity, className = "", children }) => (
  <p
    className={`shrink-0 self-center body-3 ${verbosityTextColor[verbosity] ?? "text-muted"} ${className}`}
  >
    {children}
  </p>
);

export const TimestampCell: React.FC<LogData> = ({ timestamp, verbosity }) => {
  return (
    <div>
      <LogText verbosity={verbosity} className="font-mono! whitespace-nowrap">
        {new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 2,
          hour12: false,
        })}
      </LogText>
    </div>
  );
};

export const TagCell: React.FC<LogData> = ({ tag, verbosity }) => {
  return (
    <div className="min-w-0">
      <LogText verbosity={verbosity} className="truncate font-semibold!">
        {tag}
      </LogText>
    </div>
  );
};

export const VerbosityCell: React.FC<LogData> = ({ verbosity }) => {
  return (
    <div>
      <LogText verbosity={verbosity} className="whitespace-nowrap">
        {verbosity}
      </LogText>
    </div>
  );
};

export const MessageCell: React.FC<LogData> = ({ message, verbosity }) => {
  return (
    <div className="min-w-0">
      <LogText verbosity={verbosity} className="break-words">
        {message}
      </LogText>
    </div>
  );
};

export const PayloadCell: React.FC<LogData> = ({ payload }) => {
  const { colorScheme } = useTheme();
  if (typeof payload !== "string" && Object.entries(payload).length === 0) {
    return null;
  }
  return (
    <div className="[&_*]:bg-transparent!">
      <Inspector
        data={payload}
        expandLevel={0}
        table={false}
        theme={colorScheme === "dark" ? "chromeDark" : "chromeLight"}
      />
    </div>
  );
};
