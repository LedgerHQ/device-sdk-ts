import React, { useEffect, useRef } from "react";
import { cn } from "@ledgerhq/lumen-design-core/cn";

import { LogBox } from "./styles";

export type LogEntry = {
  date: Date;
  message: string;
  type: "info" | "error" | "success";
};

export const LogPanel: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
  const logBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <LogBox ref={logBoxRef} data-testid="box_logs">
      {logs.map((log, index) => (
        <span
          key={`${log.date.toISOString()}-${index}`}
          className={cn(
            "body-3",
            log.type === "error"
              ? "text-error"
              : log.type === "success"
                ? "text-success"
                : "text-muted",
          )}
        >
          [{log.date.toLocaleTimeString()}] {log.message}
        </span>
      ))}
    </LogBox>
  );
};
