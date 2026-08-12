import React, { useEffect, useRef } from "react";
import { Text } from "@ledgerhq/react-ui";

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
        <Text
          key={`${log.date.toISOString()}-${index}`}
          variant="small"
          color={
            log.type === "error"
              ? "error.c80"
              : log.type === "success"
                ? "success.c80"
                : "neutral.c80"
          }
        >
          [{log.date.toLocaleTimeString()}] {log.message}
        </Text>
      ))}
    </LogBox>
  );
};
