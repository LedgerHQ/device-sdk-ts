import React from "react";
import { Inspector } from "react-inspector";
import styled from "styled-components";

import { type LogData } from "../types";

type Verbosity = LogData["verbosity"];

const mapVerbosityToTextProps = (
  verbosity: LogData["verbosity"],
): {
  color: string;
} => {
  const baseStyle = {
    whiteSpace: "nowrap",
    flexShrink: 0,
    alignSelf: "center",
    fontSize: 12,
  };
  switch (verbosity) {
    case "debug":
      return { ...baseStyle, color: "grey" };
    case "info":
      return { ...baseStyle, color: "black" };
    case "warning":
      return { ...baseStyle, color: "darkorange" };
    case "error":
      return { ...baseStyle, color: "red" };
    case "fatal":
      return { ...baseStyle, color: "red" };
    default:
      return { ...baseStyle, color: "grey" };
  }
};

export const LogText = styled.p<{ verbosity: Verbosity }>(
  ({ verbosity }: { verbosity: Verbosity }) => {
    return mapVerbosityToTextProps(verbosity);
  },
);

const TimestampText = styled(LogText)`
  font-size: 10px;
  padding-bottom: 2px;
`;

const TagText = styled(LogText)`
  font-weight: bold;
  width: 190px;
`;

export const TimestampCell: React.FC<LogData> = ({ timestamp, verbosity }) => {
  return (
    <div>
      <TimestampText verbosity={verbosity}>
        {new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 2,
          hour12: false,
        })}
      </TimestampText>
    </div>
  );
};

export const TagCell: React.FC<LogData> = ({ tag, verbosity }) => {
  return (
    <div>
      <TagText verbosity={verbosity}>{tag}</TagText>
    </div>
  );
};

export const VerbosityCell: React.FC<LogData> = ({ verbosity }) => {
  return (
    <div>
      <LogText verbosity={verbosity}>{verbosity}</LogText>
    </div>
  );
};

export const MessageCell: React.FC<LogData> = ({ message, verbosity }) => {
  return (
    <div>
      <LogText verbosity={verbosity}>{message}</LogText>
    </div>
  );
};

export const PayloadCell: React.FC<LogData> = ({ payload }) => {
  if (typeof payload !== "string" && Object.entries(payload).length === 0) {
    return null;
  }
  return (
    <div>
      <Inspector data={payload} expandLevel={0} table={false} />
    </div>
  );
};
